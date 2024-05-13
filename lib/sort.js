//compare object titles alphabetically 
const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
};
// return the list of todo lists sorted by completion status and title.
const sortItems = (undone, done) => {
    undone.sort(compareByTitle);
    done.sort(compareByTitle);
    return [].concat(undone, done);
};

module.exports = { sortTodoLists: sortItems, sortTodos: sortItems };