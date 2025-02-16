import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import './styles/Tasks.css';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/tasks');
        setTasks(response.data.tasks);
        setError(null);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to fetch tasks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const toggleTaskCompletion = async (taskId) => {
    try {
      const taskToToggle = tasks.find(task => task.id === taskId);
      await axios.put(`http://localhost:5000/api/tasks/${taskId}`, {
        completed: !taskToToggle.completed
      });
      
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        )
      );
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task. Please try again.');
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) {
      setError('Task name cannot be empty');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/tasks', {
        title: newTask.trim()
      });
      setTasks(prevTasks => [...prevTasks, response.data.task]);
      setNewTask('');
      setIsModalVisible(false);
      setError(null);
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task. Please try again.');
    }
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="tasks-layout">
        <Sidebar />
        <div className="tasks-main">
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-layout">
      <Sidebar />
      <div className="tasks-main">
        <div className="tasks-header">
          <h2>Tasks</h2>
          <button className="add-task-btn" onClick={() => setIsModalVisible(true)}>
            Add New Task
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="progress-section">
          <h3>Overall Progress</h3>
          <div className="progress-bar">
            <div 
              className="progress-bar-inner" 
              style={{ width: `${progress}%` }}
            ></div>
            <span className="progress-text">{progress}%</span>
          </div>
        </div>

        <div className="tasks-list">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <div
                key={task.id}
                className={`task-item ${task.completed ? 'completed' : ''}`}
                onClick={() => toggleTaskCompletion(task.id)}
              >
                <span className="task-checkbox">
                  {task.completed ? '✓' : ''}
                </span>
                <span className="task-title">{task.title}</span>
                <span className="task-status">
                  {task.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            ))
          ) : (
            <p className="no-tasks">No tasks found. Create your first task!</p>
          )}
        </div>

        {isModalVisible && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add New Task</h3>
              <form onSubmit={addTask}>
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Enter task name"
                  className="task-input"
                />
                <div className="modal-actions">
                  <button type="button" onClick={() => setIsModalVisible(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary">
                    Add Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
