const express = require("express");
const morgan = require("morgan");
// const TodoList = require("./lib/todolist");
// const Todo = require("./lib/todo");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
// const { sortTodos } = require("./lib/sort");
const store = require("connect-loki");
// const SessionPersistence = require("./lib/session-persistence");
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");

const app = express();
const host = "localhost";
const port = 8080;
const LokiStore = store(session);

// let todoLists = require("./lib/seed-data");

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// app.use((req, res, next) => {
//   let todoLists = [];
//   if ("todoLists" in req.session) {
//     req.session.todoLists.forEach(todoList => {
//       todoLists.push(TodoList.makeTodoList(todoList));
//     });
//   }
//   req.session.todoLists = todoLists;
//   next();
// });
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// app.use(async (req, res, next) => {
//   try {
//     await res.locals.store.testQuery1();
//     await res.locals.store.testQuery2();
//     await res.locals.store.testQuery3("Home Todos");
//     await res.locals.store.testQuery3("Work Todos");
//     await res.locals.store.testQuery3("No Such Todos");
//     // Note the changes on this line.
//     const maliciousCode = "'; UPDATE todos SET done = true WHERE done <> 't";
//     await res.locals.store.testQuery3(maliciousCode);
//     res.send("quitting");
//   } catch (error) {
//     next(error);
//   }
// });
// Extract session info
app.use((req, res, next) => {
  //extract credentials.
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

const authenticationRequired = (req, res, next) => {
  if (!res.locals.signedIn) {
    console.log("Unauthorized.");
    res.redirect(302, "/users/signin");
  } else {
    next();
  }
}

const validateTitle = title => {
  return body(title)
    .trim()
    .isLength({ min: 1 })
    .withMessage("The title is required.")
    .isLength({ max: 100 })
    .withMessage("Title must be between 1 and 100 characters.");     
}

app.get("/", (req, res) => {
  if (res.locals.signedIn) {
    res.redirect("/lists");
  } else {
    res.redirect("/users/signin");
  }
});

app.get("/lists",
  authenticationRequired,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoLists = await store.sortedTodoLists();
    
    let todosInfo = todoLists.map(todoList => ({
      countAllTodos: todoList.todos.length,
      countDoneTodos: todoList.todos.filter(todo => todo.isdone).length,
      isDone: store.isDoneTodoList(todoList),
    }));

    res.render("lists", { todoLists, todosInfo });
}));

app.get("/lists/new",
  authenticationRequired,
  (req, res) => {
  res.render("new-list");
});

//create a new todo list
app.post("/lists",
  authenticationRequired,
  [
    validateTitle("todoListTitle")
  ],
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoListTitle = req.body.todoListTitle;
    
    const rerenderNewList = () => {
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle
      });  
    }
    
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewList();
    } else {
      
      if(await store.existsTodoListTtitle(todoListTitle)) {
        req.flash("error", "The list title must be unique.");
        rerenderNewList();
      } else {
         let created = await store.createTodoList(todoListTitle);
         if (!created) {
          req.flash("error", "The list title must be unique.");
          rerenderNewList(); 
         } else {
          req.flash("success", "The todo list has been created.");
          res.redirect("/lists");
         }
      }
    }
  }
));

//access individual list
app.get("/lists/:todoListId",
  authenticationRequired,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    let todoList = await store.loadTodoList(todoListId);
    
    if (!todoList) throw new Error("Not Found");
    
    
    todoList.todos = await store.sortedTodos(todoList);

    let todoListInfo = {
      isDone: store.isDoneTodoList(todoList),
      hasUndone: todoList.todos.length > 0 && !this.isDone
    };
    
    res.render("list", { todoList, todoListInfo });
  })
);

//toggle todo on a list
app.post("/lists/:todoListId/todos/:todoId/toggle",
  authenticationRequired,
  catchError(async (req, res) => {
    let { todoListId, todoId } = req.params;
    let store = res.locals.store;
    let todoToggled = await store.toggledTodo(todoListId, todoId);
    
    if (!todoToggled) throw new Error("Not Found");
    let todo = await store.loadTodo(todoListId, todoId);
    if (todo.isDone) {
      req.flash("success", `"${todo.title}" marked done!`);
    } else {
      req.flash("success", `"${todo.title}" marked as NOT done!`);
    }
    
    res.redirect("/lists/" + todoListId);
  })
);

//delete a todo from list
app.post("/lists/:todoListId/todos/:todoId/destroy", 
  authenticationRequired,
  catchError(async (req, res) => {
    let { todoListId, todoId } = req.params;
    let store = res.locals.store;
    let todo = await store.loadTodo(todoListId, todoId);
    if (!todo) throw new Error("Not Found");
    
    let todoDeleted = await store.deletedTodo(todoListId, todoId);
    
    if (!todoDeleted) throw new Error("Not Found");
    req.flash("success", `"${todo.title}" deleted!`);
    res.redirect("/lists/" + todoListId);
  })
);

//mark all todos on a list done
app.post("/lists/:todoListId/complete_all",
  authenticationRequired,
  catchError(async(req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    let allCompleted = await store.completedAll(todoListId);
    
    if (!allCompleted) throw new Error("Not Found");
    
    req.flash("success", `All todos have been marked as done.`);
    res.redirect("/lists/" + todoListId);
  })
);

//create new todo
app.post("/lists/:todoListId/todos",
  authenticationRequired,
  validateTitle("todoTitle"),
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    
    let errors = validationResult(req);
    if(!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      
      let todoList = await store.loadTodoList(todoListId);
      if (!todoList) throw new Error("Not Found");
      
      todoList.todos = await store.sortedTodos(todoList);
      
      let todoListInfo = {
        isDone: store.isDoneTodoList(todoList),
        hasUndone: todoList.todos.length > 0 && !this.isDone
      };
      res.render("list", {
        flash: req.flash(),
        todoList,
        todoListInfo,
        todoTitle: req.body.todoTitle
      });
    } else {
      let added = await store.addNewTodo(todoListId, req.body.todoTitle);
      if (!added) throw new Error("Not Found");
      
      req.flash("success", `New todo added!`);
      res.redirect("/lists/" + todoListId);
    }
  })
);

//edit todo list
app.get("/lists/:todoListId/edit",
  authenticationRequired,
  catchError(async(req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    let todoList = await store.loadTodoList(todoListId);
    
    if (!todoList) throw new Error("Not Found");
    res.render("edit-list", { todoList });
    })
);

//delete the current todo list
app.post("/lists/:todoListId/destroy",
  authenticationRequired,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    let todoListDeleted = await store.deleteTodoList(todoListId);
    
    if (!todoListDeleted) throw new Error("Not Found");
    
    req.flash("success", "Todo list removed!");
    res.redirect("/lists");
  })
);

//edit the title of todo list
app.post("/lists/:todoListId/edit",
  authenticationRequired,
  [
    validateTitle("todoListTitle")
  ],
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId
    let store = res.locals.store;
    let todoListTitle = req.body.todoListTitle;
    
    const rerenderEditList = async () => {
      let todoList = await store.loadTodoList(todoListId);
      if (!todoList) throw new Error("Not found.");
      res.render("edit-list", {
        todoList,
        todoListTitle,
        flash: req.flash()
      });
    };
    
    try {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        await rerenderEditList();
      } else if (await store.existsTodoListTtitle(todoListTitle)) {
        req.flash("error", "The list title must be unique.");
        await rerenderEditList();
      } else {
        let titleChanged = await store.editTodoListTitle(todoListId, todoListTitle);
        if (!titleChanged) throw new Error("Not Found");
        
        req.flash("success", "The todo list has been updated.");
        res.redirect("/lists/" + todoListId);
      }
    } catch (error) {
      if (store.isUniqueConstraintViolation(error)) {
        req.flash("error", "The list title must be unique.");
        await rerenderEditList();
      } else {
        throw error;
      }
    }
  })
);

//sign in page.
app.get("/users/signin", (req, res) => {
  req.flash("info", "Please sign in.");
  res.render("signin", {
    flash: req.flash()
  });  
});

//sign in authentication
app.post("/users/signin",
  catchError(async (req, res) => {
    let { username, password } = req.body;
    let store = res.locals.store;
    let isAuthenticated = await store.userAuthentication(username, password);
    if (!isAuthenticated) {
      req.flash("error", "Invalid credentials.");
      res.render("signin", {
        username,
        flash: req.flash()
      });
    }
    
    req.session.username = username;
    req.session.signedIn = true;
    req.flash("info", "Welcome!");
    res.redirect("/lists");
}));

//sign out.
app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/users/signin");
});

//error handler
app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});


app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});