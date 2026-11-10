import { insertLocalSnapshot, readLocalSnapshot, standardExerciseIds } from './local.ts';
import { counts, isEmpty, liveSnapshot, signature, validateSnapshot } from './model.ts';
import { getLegacyImportState } from '../../features/auth/legacyRepository.ts';

import type { InitialSyncRemote, InitialSyncResult, SnapshotDigest, SyncReceipt, SyncSnapshot } from './model.ts';
import type { WorkoutDatabase } from '../../features/workouts/repository.ts';

export function createInitialSync(local: WorkoutDatabase, remote: InitialSyncRemote, digest: SnapshotDigest) {
  let busy = false;
  async function receiptFor(snapshot: SyncSnapshot): Promise<SyncReceipt> {
    return { version: 1, userId: local.userId, counts: counts(snapshot), sha256: await digest(signature(snapshot)) };
  }
  async function run(direction: 'upload' | 'restore', receipt?: SyncReceipt): Promise<InitialSyncResult> {
    if (busy) throw new Error('Já existe uma sincronização inicial em andamento.');
    busy = true;
    let uploadStarted = false;
    try {
      await remote.assertIdentity();
      let localSnapshot!: SyncSnapshot;
      let hasLegacy = false;
      await local.transaction(async (tx) => {
        localSnapshot = await readLocalSnapshot(tx);
        hasLegacy = (await getLegacyImportState(tx, tx.userId)).hasLegacyData;
      });
      if (hasLegacy) return { status: 'conflict', reason: 'legacy-data', counts: counts(localSnapshot) };
      if (direction === 'restore' && !isEmpty(localSnapshot)) {
        return { status: 'conflict', reason: 'local-not-empty', counts: counts(localSnapshot) };
      }
      const standardIds = await standardExerciseIds(local);
      validateSnapshot(localSnapshot, local.userId, standardIds);
      const remoteSnapshot = await remote.read();
      validateSnapshot(remoteSnapshot, local.userId, standardIds);
      if (direction === 'upload') {
        if (!isEmpty(remoteSnapshot)) {
          return signature(localSnapshot, true) === signature(remoteSnapshot, true)
            ? { status: 'already-synced', counts: counts(localSnapshot), receipt: await receiptFor(remoteSnapshot) }
            : { status: 'conflict', reason: 'both-have-data', counts: counts(localSnapshot) };
        }
        if (isEmpty(localSnapshot)) return { status: 'empty', counts: counts(localSnapshot) };
        uploadStarted = true;
        await remote.insertMissing(localSnapshot);
        const verified = await remote.read();
        if (signature(localSnapshot, true) !== signature(verified, true)) {
          return { status: 'conflict', reason: 'remote-changed', counts: counts(localSnapshot) };
        }
        let unchanged = false;
        await local.transaction(async (tx) => { unchanged = signature(localSnapshot) === signature(await readLocalSnapshot(tx)); });
        await remote.assertIdentity();
        return unchanged ? { status: 'uploaded', counts: counts(localSnapshot), receipt: await receiptFor(verified) }
          : { status: 'conflict', reason: 'local-changed', counts: counts(localSnapshot) };
      }

      // Finite verification pass, not polling: reject a changing remote dataset.
      if (signature(remoteSnapshot) !== signature(await remote.read())) {
        return { status: 'conflict', reason: 'remote-changed', counts: counts(remoteSnapshot) };
      }
      const snapshot = liveSnapshot(remoteSnapshot);
      if (isEmpty(snapshot)) return { status: 'empty', counts: counts(snapshot) };
      // Six REST table writes are not an atomic cloud transaction. A receipt
      // proves that this exact dataset passed a complete upload verification.
      if (!receipt) return { status: 'conflict', reason: 'receipt-required', counts: counts(snapshot) };
      const expected = await receiptFor(remoteSnapshot);
      if (receipt.version !== 1 || receipt.userId !== local.userId || receipt.sha256 !== expected.sha256 ||
        Object.entries(expected.counts).some(([table, count]) => receipt.counts?.[table as keyof typeof expected.counts] !== count)) {
        return { status: 'conflict', reason: 'receipt-mismatch', counts: counts(snapshot) };
      }
      let result: InitialSyncResult = { status: 'restored', counts: counts(snapshot) };
      await local.transaction(async (tx) => {
        await remote.assertIdentity();
        const current = await readLocalSnapshot(tx);
        if (!isEmpty(current)) {
          result = { status: 'conflict', reason: 'local-not-empty', counts: counts(current) };
          return;
        }
        if ((await getLegacyImportState(tx, tx.userId)).hasLegacyData) {
          result = { status: 'conflict', reason: 'legacy-data', counts: counts(current) };
          return;
        }
        await insertLocalSnapshot(tx, snapshot);
        await remote.assertIdentity();
      });
      return result;
    } catch (cause) {
      throw new Error(uploadStarted
        ? 'Upload interrompido: podem existir registros remotos parciais. Não apague dados locais; esta fase não faz retomada ou merge automático.'
        : 'Initial Sync não concluído. A restauração local, se iniciada, foi revertida integralmente.', { cause });
    } finally { busy = false; }
  }
  return { upload: () => run('upload'), restore: (receipt?: SyncReceipt) => run('restore', receipt) };
}
