const SeedData = require("./seed-data");
const deepCopy = require("./deep-copy");
const nextId = require("./next-id");
const { sortTodoLists, sortTodos } = require("./sort");
module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }
  
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }
  
  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList)
  }
  
  sortedTodos(todoList) {
    todoList = deepCopy(todoList);
    let undone = todoList.todos.filter(todo => !todo.done);
    let done = todoList.todos.filter(todo => todo.done);
                           
    return sortTodos(undone, done);
  }
  
  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }
  
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    
    if(!todoList) return undefined;
    
    return todoList.todos.find(todo => todo.id === +todoId);
  }
  
  _findTodoIndex(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    
    if (!todoList) return undefined;
    
    return todoList.todos.findIndex(todo => todo.id === +todoId);
  }
  
  _findTodoList(todoListId) {
    return this._todoLists.find(todoList => todoList.id === +todoListId);
  }
  
  toggledTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    
    if (!todo) return false;
    todo.done = !todo.done;
    return true;
  }
  
  deletedTodo(todoListId, todoId) {
    let todoIndex = this._findTodoIndex(todoListId, todoId);
    
    if (todoIndex === undefined || todoIndex === -1) return false;
    this._findTodoList(todoListId)
        .todos
        .splice(todoIndex, 1);
    
    return true;
  }
  
  completedAll(todoListId) {
    let todoList = this._findTodoList(todoListId);
    
    if (!todoList) return false;
    
    todoList.todos.forEach(todo => todo.done = true);
    return true;
  }
  
  addNewTodo(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    
    if (!todoList) return false;
    
    let newTodo = {
      id: nextId(),
      title,
      done: false
    }
    
    todoList.todos.push(newTodo);
    return true;
  }
  
  deleteTodoList(todoListId) {
    let todoListIndex = this._todoLists.findIndex(todoList => todoList.id === +todoListId);
    
    if (todoListIndex === -1) return false;
    
    this._todoLists.splice(todoListIndex, 1);
    return true;
  }
  
  editTodoListTitle(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    
    if (!todoList) return false;
    
    todoList.title = title;
    return true;
  }
  
  existsTodoListTtitle(todoListTitle) {
    return this._todoLists.some(todoList => todoList.title === todoListTitle);
  }
  
  isUniqueConstraintViolation(_error) {
    return false;
  }
  
  createTodoList(todoListTitle) {
    
    let newTodoList = {
      id: nextId(),
      title: todoListTitle,
      todos: []
    };
    
    this._todoLists.push(newTodoList);
    
    return true;
  }
};