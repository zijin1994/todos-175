// const SeedData = require("./seed-data");
// const deepCopy = require("./deep-copy");
// const nextId = require("./next-id");
// const { sortTodoLists, sortTodos } = require("./sort");
// const { Client } = require("pg");

const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");
module.exports = class pgPersistence {
  
  // async testQuery1() {
  //   const SQL = "SELECT * FROM todolists";

  //   let result = await dbQuery(SQL);
  //   console.log("query1", result.rows);
  // }
  
  // async testQuery2() {
  //   const SQL = "SELECT * FROM todos";

  //   let result = await dbQuery(SQL);
  //   console.log("query2", result.rows);
  // }
  
  // async testQuery3(title) {
  //   const SQL = "SELECT * FROM todolists WHERE title = $1";

  //   let result = await dbQuery(SQL, title);
  //   console.log("query3", result.rows);
  // }
  
  constructor(session) {
    this.username = session.username;
  }
  
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }
  
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.isdone);
  }
  
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];
    
    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });
    
    return undone.concat(done);
  }

  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  async sortedTodoLists() {
    // let todoLists = deepCopy(this._todoLists);
    // let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    // let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    // return sortTodoLists(undone, done);
    const ALL_TODOLISTS = "SELECT * FROM todolists WHERE username = $1 ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos WHERE username = $1";
    
    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(FIND_TODOS, this.username);
    
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);
    
    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    
    if(!allTodoLists || !allTodos) return undefined;
    
    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });
    
    return this._partitionTodoLists(allTodoLists);
  }
  
  async loadTodoList(todoListId) {
    let todoList = await this._findTodoList(todoListId);
    return todoList;
  }
  
  async sortedTodos(todoList) {
    // todoList = deepCopy(todoList);
    // let undone = todoList.todos.filter(todo => !todo.done);
    // let done = todoList.todos.filter(todo => todo.done);
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2 ORDER BY isDone, lower(title)";
    
    let todos = await dbQuery(FIND_TODOS, +todoList.id, this.username);
                          
    return todos.rows;
    // return sortTodos(undone, done);
  }
  
  async loadTodo(todoListId, todoId) {
    // let todo = this._findTodo(todoListId, todoId);
    // return deepCopy(todo);
    const FIND_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2 AND username = $3";
    
    let result = await dbQuery(FIND_TODO, +todoListId, +todoId, this.username);
    return result.rows[0];
  }
  
  // _findTodo(todoListId, todoId) {
  //   // let todoList = this._findTodoList(todoListId);
    
  //   // if(!todoList) return undefined;
    
  //   // return todoList.todos.find(todo => todo.id === +todoId);
  // }
  
  // _findTodoIndex(todoListId, todoId) {
  //   // let todoList = this._findTodoList(todoListId);
    
  //   // if (!todoList) return undefined;
    
  //   // return todoList.todos.findIndex(todo => todo.id === +todoId);
  // }
  
  async _findTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1 and username = $2";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 and username = $2";
    
    let resultTodoList = await dbQuery(FIND_TODOLIST, +todoListId, this.username);
    let resultTodos = await dbQuery(FIND_TODOS, +todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);
    
    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;
    
    todoList.todos = resultBoth[1].rows;
    
    return todoList;
    
    // return this._todoLists.find(todoList => todoList.id === +todoListId);
  }
  
  async toggledTodo(todoListId, todoId) {
    // let todo = this._findTodo(todoListId, todoId);
    
    // if (!todo) return false;
    // todo.done = !todo.done;
    // return true;
    
    const TOGGLE_DONE = "UPDATE todos SET isDone = NOT isDone WHERE todolist_id = $1 AND id = $2 AND username = $3";
    
    let result = await dbQuery(TOGGLE_DONE, +todoListId, +todoId, this.username);
    return result.rowCount > 0;
  }
  
  async deletedTodo(todoListId, todoId) {
    // let todoIndex = this._findTodoIndex(todoListId, todoId);
    
    // if (todoIndex === undefined || todoIndex === -1) return false;
    // this._findTodoList(todoListId)
    //     .todos
    //     .splice(todoIndex, 1);
    
    // return true;
    const DELETE_TODO = "DELETE FROM todos WHERE todolist_id = $1 AND id = $2 AND username = $3";
    let result = await dbQuery(DELETE_TODO, +todoListId, +todoId, this.username);
    
    return result.rowCount > 0;
  }
  
  async completedAll(todoListId) {
    // let todoList = this._findTodoList(todoListId);
    
    // if (!todoList) return false;
    
    // todoList.todos.forEach(todo => todo.done = true);
    // return true;\
    const COMPLETE_ALL_TODOS = "UPDATE todos SET isdone = TRUE WHERE todolist_id = $1 AND username = $2";
    let result = await dbQuery(COMPLETE_ALL_TODOS, +todoListId, this.username);
    
    return result.rowCount > 0;
  }
  
  async addNewTodo(todoListId, title) {
    // let todoList = this._findTodoList(todoListId);
    
    // if (!todoList) return false;
    
    // let newTodo = {
    //   id: nextId(),
    //   title,
    //   done: false
    // }
    
    // todoList.todos.push(newTodo);
    // return true;
    
    const CREATE_TODO = "INSERT INTO todos(title, todolist_id, username) VALUES ($1, $2, $3)";
    let result = await dbQuery(CREATE_TODO, title, +todoListId, this.username);
    
    return result.rowCount > 0;
  }
  
  async deleteTodoList(todoListId) {
    // let todoListIndex = this._todoLists.findIndex(todoList => todoList.id === +todoListId);
    
    // if (todoListIndex === -1) return false;
    
    // this._todoLists.splice(todoListIndex, 1);
    // return true;
    const DELETE_TODOLIST = "DELETE FROM todolists WHERE id = $1 AND username = $2";
    let result = await dbQuery(DELETE_TODOLIST, +todoListId, this.username);
    
    return result.rowCount > 0;
  }
  
  async editTodoListTitle(todoListId, title) {
    // let todoList = this._findTodoList(todoListId);
    
    // if (!todoList) return false;
    
    // todoList.title = title;
    // return true;
    const EDIT_TITLE = "UPDATE todolists SET title = $1 WHERE id = $2 AND username = $3";
    let result = await dbQuery(EDIT_TITLE, title, +todoListId, this.username);
    
    return result.rowCount > 0;
  }
  
  async existsTodoListTtitle(todoListTitle) {
    // return this._todoLists.some(todoList => todoList.title === todoListTitle);
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE title = $1 AND username = $2";
    let result = await dbQuery(FIND_TODOLIST, todoListTitle, this.username);
    
    return result.rowCount > 0;
  }
  
  async createTodoList(todoListTitle) {
    
    // let newTodoList = {
    //   id: nextId(),
    //   title: todoListTitle,
    //   todos: []
    // };
    
    // this._todoLists.push(newTodoList);
    
    // return true;
    const CREATE_TODOLIST = "INSERT INTO todolists(title, username) VALUES ($1, $2)";
    
    try {
      let result = await dbQuery(CREATE_TODOLIST, todoListTitle, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
  
  async userAuthentication(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users WHERE username = $1";
    
    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    
    if (result.rowCount === 0) return false;
    
    return bcrypt.compare(password, result.rows[0].password);
  }
};