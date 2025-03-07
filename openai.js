// import { ilike } from "drizzle-orm";
// import { db } from "./db/index.js";
// import { todosTable } from "./db/schema.js";
// import OpenAI from "openai";
// import  readlineSync  from "readline-sync";


// const client = new OpenAI(process.env.OPENAI_API_KEY);

// async function getAllTodos() {
//   const todos = await db.select().from(todosTable);
//   return todos;
// }

// async function createTodo(todo) {
//   const [newTodo] = await db.insert(todo).values({ todo }).returning({id : todosTable.id});
//     return newTodo.id;
// }

// async function searchTodos(search) {
//   const todos = await db
//     .select()
//     .from(todosTable)
//     .where(ilike(todosTable.todo, `%${search}%`));
//   return todos;
// }
// async function deleteTodoById(id) {
//   await db.delete().from(todosTable).where(todosTable.id.eq(id));
// }

// const tools = {
//     getAllTodos: getAllTodos,
//     createTodo: createTodo,
//     searchTodos: searchTodos,
//     deleteTodoById: deleteTodoById
// } 

// const SYSTEM_PROMPT = `

// You are an AI To-Do List Assistant with START, PLAN, ACTION, Obersation and Output State.
// Wait for the user prompt and first PLAN using available tools.
// After Planning, Take the actions with appropriate tools and wait for Observation based on Action.
// Once you get the Observation, Return the AI response based on START prompt and Observation.



// You can manage tasks by adding, viewing, updating, and deleting tasks.
// You must strictl follow the JSON ouptut format

// Todo DB Schema:
// id : Int and Primary Key
// todo : String
// createdAt : Date Time
// updatedAt : Date Time


// Available Tools:
// - getAllTodos(): Returns all the todos from Database
// - createTodo(todo: string): Creates a new todo in the Database and takes todo as a string and returns the ID of the newly created todo
// - searchTodos(search: string): Searches for all todos matching the query string using ilike operator
// - deleteTodoById(id: string): Deletes a todo by ID given in database 

// Example:
// START
// {
// "type" : "user", "user" : "Add a task for shopping groceries."
// }
// {
// "type: "plan" , "plan" : "I will try to get more context on what user needs to shop."
// }
// {
// "type: "output" , "plan" : "can you tell me what all items you need to shop for?"
// }
// {
// "type": "user", "user" : "I want to shop for milk, Kurkrue, lays and choco"
// {
// "type: "plan" , "plan" : "I will use createTodo to create a new Todo in DB."
// }
// {
// "type" : "action" , "function" :"createTodo", "input" : "shopping for milk, Kurkrue, lays and choco"
// }
// {
// "type" : "observation" , "observation" : "2"
// }
// {
// "type" : "output" , "output" : "Your todo has been added successfully"
// }
// `;

// const messages = [ { type: "system", system: SYSTEM_PROMPT } ];


// while(true){
//     const query = readlineSync.question('>> ');
//     const userMessage = {
//         type: "user",
//         user: query
//     };
//     messages.push({role : "user", content: JSON.stringify(userMessage)});

//     while(true) {
//         const chat = await client.chat.completions.create({
//             model: "gpt-3.5-turbo",
//             messages: messages,
//             response_format : { type : 'json_object'}
//         });
//         const result = chat.choices[0].message.content;
//         messages.push({role: "assistant", content: result});

//         const action = JSON.parse(result);

//         if(action.type === "output") {
//             console.log(`Assitant:${action.output}`);
//             break;
//         }
//         else if(action.type ==='action'){
//             const fn = tools[action.function];
//             if(!fn){
//                 throw new Error(`Function ${action.function} not found`);
//             }
//             const observation = await fn(action.input);
//             const observationMessage = {
//                 type: "observation",
//                 observation: observation
//             };
//             messages.push({role: "developer", content: JSON.stringify(observationMessage)});
//         }
//     }
// }