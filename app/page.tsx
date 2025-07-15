"use client";

import { useState, useCallback } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, NodeChange, EdgeChange, Connection, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import VideoModal from './components/VideoModal';
 
const initialNodes: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Unicorn' } },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Startup' } },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];
 
export default function App() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [taskName, setTaskName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<Id<"tasks"> | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<any>(null);
 
  const createTask = useMutation(api.tasks.createTask);
  const tasks = useQuery(api.tasks.get);
  const generations = useQuery(api.tasks.getGenerations);
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

  const handleCreateVideo = async () => {
    if (!taskName.trim() || !prompt.trim()) return;
    
    setIsCreating(true);
    try {
      const idempotencyKey = prompt;
      
      console.log('Creating video task with idempotency key:', idempotencyKey);
      console.log('Task name:', taskName);
      console.log('Prompt:', prompt);
      
      const taskId = await createTask({
        name: taskName,
        description: prompt,
        idempotency_key: idempotencyKey,
        type: "replicate",
        task_args: {
          model: "luma/ray-flash-2-540p", // cheap as shit
          input: {
            prompt: prompt,
          },
        },
      });
      
      setCreatedTaskId(taskId);
      setTaskName('');
      setPrompt('');
    } catch (error) {
      console.error('Failed to create video task:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewOutput = (generation: any) => {
    setSelectedGeneration(generation);
    setModalOpen(true);
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
        <h2>Video Generator</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Task name (e.g., 'My Awesome Video')"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <textarea
            placeholder="Describe the video you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', height: '80px' }}
          />
          <button 
            onClick={handleCreateVideo}
            disabled={isCreating || !taskName.trim() || !prompt.trim()}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {isCreating ? 'Creating Video...' : 'Generate Video'}
          </button>
        </div>

        {createdTaskId && (
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h3>Video Task Created:</h3>
            <p><strong>Task ID:</strong> {createdTaskId}</p>
            {currentTask && (
              <>
                <p><strong>Status:</strong> {currentTask.status}</p>
                <p><strong>Progress:</strong> {currentTask.progress}%</p>
                <p><strong>Created:</strong> {new Date(currentTask.createdAt).toISOString()}</p>
              </>
            )}
          </div>
        )}

        {tasks && tasks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Your Video Tasks:</h3>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
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

        {generations && generations.length > 0 && (
          <div>
            <h3>Your Generated Videos:</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {generations.map((generation) => (
                <div key={generation._id} style={{ padding: '8px', border: '1px solid #ddd', marginBottom: '8px', borderRadius: '4px' }}>
                  <p><strong>Video Output</strong></p>
                  <p>Generated: {new Date(generation.createdAt).toISOString()}</p>
                  <button
                    onClick={() => handleViewOutput(generation)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    View Video
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <VideoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        storageId={selectedGeneration?.storageId}
        taskName="Generated Video"
      />
    </div>
  );
}