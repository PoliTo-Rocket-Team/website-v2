"use client";

import {
    checkIfAlreadyApplied,
    getAllOpenPositions
} from "@/app/actions/user/apply-to-position";
import { ApplyPosition } from "@/app/actions/user/get-apply-positions";
import { ApplyPositions } from "@/components/apply-positions-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

export default function ApplyPage() {
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedPositions, setAppliedPositions] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      const { positions } = await getAllOpenPositions();
      setPositions(positions);
      
      // Check which positions user has already applied to
      const appliedSet = new Set<number>();
      for (const position of positions) {
        const { hasApplied } = await checkIfAlreadyApplied(position.id);
        if (hasApplied) {
          appliedSet.add(position.id);
        }
      }
      setAppliedPositions(appliedSet);
    } catch (error) {
      console.error("Error loading positions:", error);
      setMessage({ type: 'error', text: 'Failed to load positions. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = async (position: ApplyPosition) => {
    if (appliedPositions.has(position.id)) {
      setMessage({ type: 'error', text: 'You have already applied to this position.' });
      return;
    }

    // Check authentication immediately when Apply button is clicked
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // User is not authenticated - redirect to sign-in with redirect back to application form
      window.location.href = `/sign-in?redirect=/apply/${position.id}`;
      return;
    }

    // User is authenticated - proceed to application form
    window.location.href = `/apply/${position.id}`;
  };

  const renderActionButtons = (position: ApplyPosition) => {
    const hasApplied = appliedPositions.has(position.id);
    
    return (
      <Button
        onClick={() => handleApplyClick(position)}
        disabled={hasApplied}
        variant={hasApplied ? "outline" : "default"}
        className={hasApplied 
          ? "border-muted text-muted-foreground" 
          : "bg-orange-500 text-white hover:bg-orange-600"
        }
      >
        {hasApplied ? "Already Applied" : "Apply"}
      </Button>
    );
  };

  if (loading) {
    return <div className="p-8 text-center">Loading positions...</div>;
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-center mb-6 text-primary">
        Open Positions
      </h2>
      
      {message && (
        <div className={`mb-4 p-4 text-center ${
          message.type === 'success' 
            ? 'text-foreground border-l-2 border-foreground' 
            : 'text-destructive-foreground border-l-2 border-destructive-foreground'
        }`}>
          {message.text}
        </div>
      )}
      
      <ApplyPositions
        positions={positions}
        renderActionButtons={renderActionButtons}
        showStatusSwitch={false}
      />
    </div>
  );
} 