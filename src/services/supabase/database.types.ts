// Empty public schema on purpose. Replace with Supabase-generated types when
// the first actual cloud migration is introduced; do not invent domain tables.
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
