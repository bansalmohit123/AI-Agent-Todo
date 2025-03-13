import { ilike } from "drizzle-orm";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import readlineSync from "readline-sync";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getAllTodos() {
  return await db.select().from(todosTable);
}

async function createTodo(todo) {
  const [newTodo] = await db
    .insert(todosTable)
    .values({ todo })
    .returning({ id: todosTable.id });

  return newTodo.id;
}

async function searchTodos(search) {
  return await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
}

async function deleteTodoById(id) {
  await db.delete(todosTable).where(todosTable.id.eq(id));
}

const tools = { getAllTodos, createTodo, searchTodos, deleteTodoById };

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the actions with appropriate tools and wait for Observation based on Action.
Once you get the Observation, Return the AI response based on START prompt and Observation.

You must strictly follow the JSON output format.

Todo DB Schema:
id : Int and Primary Key
todo : String
createdAt : Date Time
updatedAt : Date Time

Available Tools:
- getAllTodos(): Returns all the todos from Database
- createTodo(todo: string): Creates a new todo in the Database and takes todo as a string and returns the ID of the newly created todo
- searchTodos(search: string): Searches for all todos matching the query string using ilike operator
- deleteTodoById(id: string): Deletes a todo by ID given in database 
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

async function main() {
  while (true) {
    const query = readlineSync.question(">> ");
    messages.push({ role: "user", content: query });

    try {
      let continueLoop = true;

      while (continueLoop) {
        const chat = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          response_format: { type: "json_object" }
        });

        const result = chat.choices[0].message.content;

        let action;
        try {
          action = JSON.parse(result);
          console.log(JSON.stringify(action, null, 2));
        } catch (error) {
          console.error("Error parsing JSON:", result);
          break;
        }

        messages.push({ role: "assistant", content: result });

        if (action.state === "OUTPUT") {
          console.log(`Assistant: ${action.output}`);
          continueLoop = false;
        } else if (action.state === "ACTION") {
          const fn = tools[action.tool];
          if (!fn) {
            console.error(`Function ${action.toolFunction} not found`);
            break;
          }
          const observation = await fn(action.parameters);
          messages.push({
            role: "assistant",
            content: JSON.stringify({ type: "observation", observation }),
          });
        }
      }
    } catch (error) {
      console.error("Error during AI processing:", error);
    }
  }
}

main();
