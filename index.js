import { ilike } from "drizzle-orm";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import readlineSync from "readline-sync";
import dotenv from "dotenv";

dotenv.config();

// Initialize Google Gemini Pro
const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-1.5-flash",
  maxOutputTokens: 2048,
});

// 🛠️ Database Utility Functions
async function getAllTodos() {
  return await db.select().from(todosTable);
}

async function createTodo(todo) {
  const [newTodo] = await db.insert(todosTable).values({ todo }).returning({ id: todosTable.id });
  return newTodo.id;
}

async function searchTodos(search) {
  return await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
}

async function deleteTodoById(id) {
  await db.delete().from(todosTable).where(todosTable.id.eq(id));
}

const tools = {
  getAllTodos,
  createTodo,
  searchTodos,
  deleteTodoById,
};

// ─── Helper: Parse TOOL_CALL Responses ─────────────────────────────
function parseToolCall(text) {
  // Remove any "assistant:" prefixes and the "TOOL_CALL" keyword
  text = text.replace(/assistant:\s*/gi, "").trim();
  text = text.replace(/^TOOL_CALL\s*/i, "").trim();

  // Match pattern: [optional_var =] functionName(param1=value1, param2=value2)
  // Example: "deleteTodoById(id=1)" or "new_todo_id = createTodo(todo=\"movieioio\")"
  const regex = /^(?:\w+\s*=\s*)?(\w+)\((.*)\)$/;
  const match = text.match(regex);
  if (!match) {
    throw new Error("Cannot parse tool call: " + text);
  }
  const functionName = match[1];
  const paramString = match[2].trim();
  let input = {};
  if (paramString) {
    // Split by commas (assuming no commas within quoted strings)
    const parts = paramString.split(",").map((s) => s.trim());
    for (const part of parts) {
      const [key, value] = part.split("=").map((s) => s.trim());
      let parsedValue = value;
      // Remove surrounding quotes if present
      if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
        parsedValue = value.substring(1, value.length - 1);
      } else if (!isNaN(value)) {
        parsedValue = Number(value);
      }
      input[key] = parsedValue;
    }
  }
  return { functionName, input };
}

// ─── System Prompt (Example is preserved) ─────────────────────────────
const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, OBSERVATION, and OUTPUT states.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the actions with appropriate tools and wait for Observation based on Action.
Once you get the Observation, Return the AI response based on START prompt and Observation.

Todo DB Schema:
id : Int and Primary Key
todo : String
createdAt : Date Time
updatedAt : Date Time

Available Tools:
- getAllTodos(): Returns all the todos from Database
- createTodo(todo: string): Creates a new todo in the Database and returns the new ID
- searchTodos(search: string): Searches for all todos matching the query
- deleteTodoById(id: number): Deletes a todo by ID

Response Format:
{
  "type": "<plan | action | observation | output>",
  "function": "<function_name_if_applicable>",
  "input": "<parameters_for_function_if_applicable>",
  "output": "<response_text_if_applicable>"
}


`;

// Store conversation history
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

// ─── Main Loop ─────────────────────────────────────────────────────────
while (true) {
  const query = readlineSync.question(">> ");
  
  // Append user message
  messages.push({ role: "user", content: query });

  while (true) {
    try {
      // Convert messages to a single string to feed into the LLM
      const formattedInput = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

      // Call Gemini AI
      const chat = await llm.invoke(formattedInput);

      if (!chat || !chat.content) {
        console.error("Error: LLM returned an invalid response", chat);
        break;
      }

      const result = chat.content;
      messages.push({ role: "assistant", content: result });

      // Determine if the response is a TOOL_CALL response or a JSON response
      let action;
      if (result.trim().toUpperCase().startsWith("TOOL_CALL")) {
        try {
          action = (() => {
            const toolCall = parseToolCall(result);
            return {
              type: "action",
              function: toolCall.functionName,
              input: toolCall.input,
            };
          })();
        } catch (error) {
          console.error("Error parsing TOOL_CALL response:", result, error);
          break;
        }
      } else {
        try {
          // Remove all "assistant:" occurrences globally
          const cleanedResult = result.replace(/assistant:\s*/gi, "");
          // console.log("Cleaned Result:", cleanedResult);
          action = JSON.parse(cleanedResult);
        } catch (error) {
          console.error("Error parsing AI response:", result);
          break;
        }
      }

      if (action.type === "output") {
        console.log(`Assistant: ${action.output || "No output provided."}`);
        break;
      } else if (action.type === "action") {
        const fn = tools[action.function];
        if (!fn) {
          console.error(`Function ${action.function} not found`);
          break;
        }

        // Ensure input is correctly structured
        let input = action.input;
        if (typeof input === "string") {
          try {
            input = JSON.parse(input);
          } catch (error) {
            console.error("Invalid input format:", input);
            break;
          }
        }
        if (input === null) {
          input = {};
        }
        // For functions that require an ID, ensure proper format.
        if (action.function === "deleteTodoById" && typeof input === "object" && !("id" in input)) {
          input = { id: parseInt(input, 10) };
        }

        const observation = await fn(input);
        const observationMessage = {
          type: "observation",
          observation: observation,
        };
        messages.push({ role: "assistant", content: JSON.stringify(observationMessage) });
      }
    } catch (err) {
      console.error("Error invoking LLM:", err);
      break;
    }
  }
}
