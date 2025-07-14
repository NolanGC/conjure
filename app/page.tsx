"use client";

import { useState, useCallback } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, NodeChange, EdgeChange, Connection, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
 
const initialNodes: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Unicorn' } },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Startup' } },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];
 
export default function App() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<Id<"tasks"> | undefined>(undefined);
 
  const createTask = useMutation(api.tasks.createTask);
  const tasks = useQuery(api.tasks.get);
  const currentTask = useQuery(api.tasks.getTask, 
    createdTaskId ? { taskId: createdTaskId } : "skip"
  );
 
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const handleCreateTask = async () => {
    if (!taskName.trim()) return;
    
    setIsCreating(true);
    try {
      const idempotencyKey = taskName;
      
      console.log('Creating task with idempotency key:', idempotencyKey);
      console.log('Task name:', taskName);
      console.log('Task description:', taskDescription);
      
      const taskId = await createTask({
        name: taskName,
        description: taskDescription,
        idempotency_key: idempotencyKey,
      });
      
      setCreatedTaskId(taskId);
      setTaskName('');
      setTaskDescription('');
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsCreating(false);
    }
  };
 
  return (
    <div style={{ width: '100vw', height: 'calc(100vh - 80px)', display: 'flex' }}>
      <div style={{ width: '50%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        />
      </div>
      <div style={{ width: '50%', height: '100%', padding: '20px', overflowY: 'auto' }}>
        <h2>Task Creator</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Task name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <textarea
            placeholder="Task description"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', height: '60px' }}
          />
          <button 
            onClick={handleCreateTask}
            disabled={isCreating || !taskName.trim()}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>

        {createdTaskId && (
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h3>Created Task:</h3>
            <p><strong>Task ID:</strong> {createdTaskId}</p>
            {currentTask && (
              <>
                <p><strong>Status:</strong> {currentTask.status}</p>
                <p><strong>Progress:</strong> {currentTask.progress}%</p>
                <p><strong>Created:</strong> {new Date(currentTask.createdAt).toLocaleString()}</p>
              </>
            )}
          </div>
        )}

        {tasks && tasks.length > 0 && (
          <div>
            <h3>Your Tasks:</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {tasks.map((task) => (
                <div key={task._id} style={{ padding: '8px', border: '1px solid #ddd', marginBottom: '8px', borderRadius: '4px' }}>
                  <p><strong>{task.name}</strong></p>
                  <p>{task.description}</p>
                  <p>Status: {task.status} | Progress: {task.progress}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}