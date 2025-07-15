"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageId: Id<"_storage"> | undefined;
  taskName: string;
}

export default function VideoModal({ isOpen, onClose, storageId, taskName }: VideoModalProps) {
  const videoUrl = useQuery(api.tasks.getVideoUrl, 
    storageId ? { storageId } : "skip"
  );

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
          }}
        >
          ×
        </button>
        
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
          {taskName}
        </h2>
        
        {videoUrl ? (
          <video
            controls
            style={{
              width: '100%',
              maxWidth: '800px',
              height: 'auto',
            }}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            Loading video...
          </div>
        )}
      </div>
    </div>
  );
} 