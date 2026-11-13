import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

// Run the installed Router's declaration/visibility code, isolating only native
// dependencies and the hook host. This tests registration, not animation frames.
function evaluate(source: string, imports: Record<string, unknown>, warnings: string[]) {
  const exports: Record<string, unknown> = {};
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      assert(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    console: { warn: (message: string) => warnings.push(message) },
    process: { env: { NODE_ENV: 'development' } },
    __DEV__: true,
  });
  return exports;
}

const routerSource = (path: string) => readFileSync(
  new URL(`../node_modules/expo-router/build/${path}.js`, import.meta.url), 'utf8',
);

test('SDK 58 registers all four direct tab declarations without the no-screens warning', () => {
  const warnings: string[] = [];
  const hooks = {
    ...React,
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => void) => effect(),
  };
  const screenModule = evaluate(routerSource('views/Screen'), {
    react: hooks,
    '../useNavigation': {},
    './useSafeLayoutEffect': {},
  }, warnings);
  const Tabs = Object.assign(() => null, { Screen: screenModule.Screen });
  const layoutSource = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(layoutSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const layout = evaluate(compiled, {
    react: hooks,
    'react/jsx-runtime': jsxRuntime,
    'react-native': {},
    '@expo/vector-icons/Ionicons': {},
    'expo-router/js-tabs': { Tabs },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/components/AppPressable': {},
    '@/components/AppText': {},
    '@/hooks/useReducedMotion': { useReducedMotion: () => false },
    '@/theme/tokens': { colors: {}, sizes: {}, spacing: {}, typography: {} },
    '@/utils/animations': { motion: { content: 200 } },
  }, warnings);
  const tree = (layout.default as () => React.ReactElement<{ children: React.ReactNode }>)();
  const filterModule = evaluate(routerSource('layouts/withLayoutContext'), {
    react: hooks,
    '../Route': {},
    '../native-tabs/NativeTabTrigger': { isNativeTabTrigger: () => false },
    '../useScreens': {},
    '../views/Protected': { isProtectedReactElement: () => false },
    '../views/Screen': screenModule,
    './GuardContext': { normalizeRouteName: (name: string) => name },
  }, warnings);
  const filter = filterModule.useFilterScreenChildren as (children: React.ReactNode) => {
    screens: { name: string; options: { title: string } }[];
  };
  const { screens } = filter(tree.props.children);
  const expected = ['index', 'workouts', 'history', 'account'];
  assert.deepEqual(Array.from(screens, (screen) => screen.name), expected);
  assert.deepEqual(Array.from(screens, (screen) => screen.options.title), ['Início', 'Treinos', 'Histórico', 'Conta']);

  const orderModule = evaluate(routerSource('utils/orderRoutesByRouteNames'), {}, warnings);
  const visibilityModule = evaluate(routerSource('standard-navigation/useVisibleTabsWithRedirect'), {
    react: hooks,
    '../Route': { useRouteNode: () => ({ contextKey: './(tabs)/_layout.tsx' }) },
    '../constants': {},
    '../global-state/useRouterActions': { useRouterActions: () => ({ replace: () => assert.fail('Unexpected redirect') }) },
    '../layouts/GuardContext': { useGuardRedirect: () => undefined },
    '../link/preview/PreviewRouteContext': { useIsPreview: () => false },
    '../react-navigation/native': { useIsFocused: () => true },
    '../routeNode': { getValidInitialRouteName: () => 'index' },
    '../utils/orderRoutesByRouteNames': orderModule,
    './useBuildHref': { useBuildHref: () => (route: { name: string }) => `/${route.name}` },
  }, warnings);
  const routes = expected.map((name) => ({ name, key: name }));
  const descriptors = Object.fromEntries(routes.map((route) => [route.key, {
    routeSource: screens.some((screen) => screen.name === route.name) ? 'layout' : 'filesystem',
    options: {},
  }]));
  const visible = visibilityModule.useVisibleTabsWithRedirect as (args: unknown) => {
    visibleRoutes: typeof routes; focusedIndex: number;
  };
  for (const name of expected) {
    const result = visible({ routes, routeNames: expected, focusedRouteKey: name, descriptors });
    assert.deepEqual(Array.from(result.visibleRoutes, (route) => route.name), expected);
    assert.equal(result.focusedIndex, expected.indexOf(name));
  }
  assert.deepEqual(warnings, []);
});
