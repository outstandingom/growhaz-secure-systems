// src/hooks/useBuildQueue.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface QueueEntry {
  id: string;
  build_id: string;
  status: "waiting" | "building" | "completed" | "failed";
  position: number | null;
  created_at: string;
  started_at: string | null;
}

export function useBuildQueue() {
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const { toast } = useToast();
  const channelRef = useRef<any>(null);

  // Fetch active build count
  const fetchActiveCount = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_active_build_count");
    if (!error && data !== null) {
      setActiveCount(data as number);
    }
  }, []);

  // Fetch queue position for current entry
  const fetchPosition = useCallback(async (queueId: string) => {
    const { data, error } = await supabase.rpc("get_queue_position", {
      p_queue_id: queueId,
    });
    if (!error && data !== null) {
      setQueuePosition(data as number);
    }
  }, []);

  // Join the queue — returns queue entry and whether build can start immediately
  const joinQueue = useCallback(
    async (buildId: string): Promise<{ entry: QueueEntry; canStart: boolean } | null> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Error",
          description: "Please log in first",
          variant: "destructive",
        });
        return null;
      }

      try {
        // Insert into queue
        const { data: inserted, error: insertError } = await supabase
          .from("build_queue")
          .insert({
            user_id: session.user.id,
            build_id: buildId,
            status: "waiting",
          })
          .select()
          .single();

        if (insertError || !inserted) {
          throw new Error(insertError?.message || "Failed to join queue");
        }

        const entry: QueueEntry = {
          id: inserted.id,
          build_id: inserted.build_id,
          status: inserted.status as QueueEntry["status"],
          position: null,
          created_at: inserted.created_at,
          started_at: inserted.started_at,
        };

        // Try to start immediately
        const { data: canStart, error: startError } = await supabase.rpc(
          "try_start_build",
          { p_queue_id: entry.id }
        );

        if (!startError && canStart) {
          entry.status = "building";
          setQueueEntry(entry);
          setQueuePosition(null);
          return { entry, canStart: true };
        }

        // Couldn't start — get position
        const { data: pos } = await supabase.rpc("get_queue_position", {
          p_queue_id: entry.id,
        });
        entry.position = (pos as number) || null;
        setQueueEntry(entry);
        setQueuePosition(entry.position);

        // Subscribe to changes on this queue entry
        subscribeToQueue(entry.id, session.user.id);

        return { entry, canStart: false };
      } catch (err: any) {
        toast({
          title: "Queue Error",
          description: err.message || "Failed to join build queue",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  // Subscribe to real-time updates for this queue entry
  const subscribeToQueue = useCallback(
    (queueId: string, userId: string) => {
      // Clean up previous subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel(`build_queue_${queueId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "build_queue",
            filter: `id=eq.${queueId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            setQueueEntry((prev) => ({
              ...prev!,
              status: updated.status,
              started_at: updated.started_at,
            }));

            if (updated.status === "building") {
              setQueuePosition(null);
            } else if (updated.status === "waiting") {
              fetchPosition(queueId);
            }
          }
        )
        .subscribe();
    },
    [fetchPosition]
  );

  // Mark build as completed
  const markCompleted = useCallback(async (queueId: string) => {
    await supabase
      .from("build_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", queueId);
    setQueueEntry(null);
    setQueuePosition(null);
  }, []);

  // Mark build as failed
  const markFailed = useCallback(async (queueId: string) => {
    await supabase
      .from("build_queue")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", queueId);
    setQueueEntry(null);
    setQueuePosition(null);
  }, []);

  // Reset queue state
  const resetQueue = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setQueueEntry(null);
    setQueuePosition(null);
  }, []);

  // Fetch active count on mount
  useEffect(() => {
    fetchActiveCount();
    const interval = setInterval(fetchActiveCount, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchActiveCount]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    joinQueue,
    queueEntry,
    queuePosition,
    queueStatus: queueEntry?.status || null,
    activeCount,
    markCompleted,
    markFailed,
    resetQueue,
    fetchActiveCount,
  };
}
