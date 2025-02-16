const express = require("express");
const router = express.Router();

// Mock task data
let tasks = [
  { id: 1, title: "Prepare email templates", completed: false },
  { id: 2, title: "Schedule campaigns", completed: true },
  { id: 3, title: "Follow up with venues", completed: false },
];

// Get all tasks
router.get("/", (req, res) => {
  res.json(tasks);
});

// Add a new task
router.post("/", (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  const newTask = {
    id: tasks.length + 1, // Generate a new ID
    title,
    completed: false,
  };

  tasks.push(newTask);
  res.status(201).json({ message: "Task added successfully", task: newTask });
});

// Update a task (mark as completed or update title)
router.put("/:id", (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, completed } = req.body;

  const task = tasks.find((task) => task.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (title) task.title = title;
  if (typeof completed === "boolean") task.completed = completed;

  res.json({ message: "Task updated successfully", task });
});

// Delete a task
router.delete("/:id", (req, res) => {
  const taskId = parseInt(req.params.id);

  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const deletedTask = tasks.splice(index, 1); // Remove the task
  res.json({ message: "Task deleted successfully", task: deletedTask[0] });
});

// Get progress (percentage of completed tasks)
router.get("/progress", (req, res) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  res.json({ totalTasks, completedTasks, progress: Math.round(progress) });
});

module.exports = router;
