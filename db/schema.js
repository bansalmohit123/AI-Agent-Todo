import  {integer, pgTable, text, timestamp }  from "drizzle-orm/pg-core";

export const todosTable = pgTable("todos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  todo: text("todo").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), // For now, set default
});
