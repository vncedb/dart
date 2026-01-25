import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDB } from '../lib/db-client';

export function useActiveJob() {
  const { user } = useAuth();
  const [activeJob, setActiveJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveJob = useCallback(async () => {
    // CRITICAL FIX: Explicitly handle missing user OR missing user.id
    if (!user || !user.id) {
        setLoading(false);
        return;
    }
    
    const userId = String(user.id);

    try {
      const db = await getDB();
      // 1. Get Profile to find active ID
      const profile: any = await db.getFirstAsync(
        'SELECT current_job_id FROM profiles WHERE id = ?', 
        [userId]
      );
      
      if (profile?.current_job_id) {
        // 2. Get Job Details from Local DB
        const job: any = await db.getFirstAsync(
          'SELECT * FROM job_positions WHERE id = ?', 
          [profile.current_job_id]
        );
        
        if (job) {
          // Safe JSON parsing
          try {
            job.work_schedule = typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule;
            job.break_schedule = typeof job.break_schedule === 'string' ? JSON.parse(job.break_schedule) : job.break_schedule;
          } catch (e) {
             // Fallback
          }
          setActiveJob(job);
        } else {
          setActiveJob(null);
        }
      } else {
        setActiveJob(null);
      }
    } catch (e) {
      console.error("Error fetching active job:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Re-fetch whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchActiveJob();
    }, [fetchActiveJob])
  );

  return { activeJob, loading, refreshActiveJob: fetchActiveJob };
}