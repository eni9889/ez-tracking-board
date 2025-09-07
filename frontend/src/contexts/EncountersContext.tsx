import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

interface IncompleteNote {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: string;
  lastCheckStatus?: string | null;
  lastCheckDate?: string | null;
  issuesFound?: boolean;
  todoCreated?: boolean;
  todoCount?: number;
  hasValidIssues?: boolean;
}

interface EncountersContextType {
  encounters: IncompleteNote[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  loadEncounters: () => Promise<void>;
  refreshEncounters: () => Promise<void>;
  getCurrentIndex: (encounterId: string) => number;
  getPreviousEncounter: (encounterId: string) => IncompleteNote | null;
  getNextEncounter: (encounterId: string) => IncompleteNote | null;
}

const EncountersContext = createContext<EncountersContextType | undefined>(undefined);

export const useEncounters = () => {
  const context = useContext(EncountersContext);
  if (context === undefined) {
    throw new Error('useEncounters must be used within an EncountersProvider');
  }
  return context;
};

interface EncountersProviderProps {
  children: ReactNode;
}

export const EncountersProvider: React.FC<EncountersProviderProps> = ({ children }) => {
  const [encounters, setEncounters] = useState<IncompleteNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch incomplete notes from EZDerm
      const notes = await aiNoteCheckerService.getIncompleteNotes();
      console.log(`📋 Context: Fetched ${notes.length} incomplete notes from API`);
      
      // Remove duplicates (same logic as main page)
      const uniqueNotes = notes.filter((note, index, array) => 
        array.findIndex(n => n.encounterId === note.encounterId) === index
      );
      
      if (uniqueNotes.length !== notes.length) {
        console.log(`🔧 Context: Removed ${notes.length - uniqueNotes.length} duplicate notes`);
      }
      
      // Get existing check results for these notes
      const checkResults = await aiNoteCheckerService.getNoteCheckResults(100, 0);
      const checkResultsMap = new Map(
        checkResults.map(result => [result.encounterId, result])
      );
      
      // Combine the data - ToDo status is now included in the backend response
      const notesWithStatus = uniqueNotes.map(note => {
        return {
          ...note,
          lastCheckStatus: checkResultsMap.get(note.encounterId)?.status || null,
          lastCheckDate: checkResultsMap.get(note.encounterId)?.checkedAt || null,
          issuesFound: checkResultsMap.get(note.encounterId)?.issuesFound || false,
          // ToDo status is now included directly from the backend
          todoCreated: note.todoCreated || false,
          todoCount: note.todoCount || 0
        };
      });
      
      // Sort by date of service (newest first)
      const sortedNotes = notesWithStatus.sort((a, b) => {
        return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
      });
      
      setEncounters(sortedNotes);
      setLastRefresh(new Date());
      console.log(`✅ Context: Loaded ${sortedNotes.length} encounters into context`);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load encounters');
      console.error('❌ Context: Error loading encounters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEncounters = useCallback(async () => {
    console.log('🔄 Context: Refreshing encounters...');
    await loadEncounters();
  }, [loadEncounters]);

  const getCurrentIndex = useCallback((encounterId: string): number => {
    const index = encounters.findIndex(encounter => encounter.encounterId === encounterId);
    console.log('📍 getCurrentIndex:', { encounterId, foundIndex: index, totalEncounters: encounters.length });
    return index;
  }, [encounters]);

  const getPreviousEncounter = useCallback((encounterId: string): IncompleteNote | null => {
    const currentIndex = getCurrentIndex(encounterId);
    console.log('⬅️ getPreviousEncounter:', { encounterId, currentIndex, hasPrevious: currentIndex > 0 });
    if (currentIndex > 0) {
      const prevEncounter = encounters[currentIndex - 1];
      console.log('✅ Previous encounter:', { id: prevEncounter.encounterId, name: prevEncounter.patientName });
      return prevEncounter;
    }
    return null;
  }, [encounters, getCurrentIndex]);

  const getNextEncounter = useCallback((encounterId: string): IncompleteNote | null => {
    const currentIndex = getCurrentIndex(encounterId);
    const hasNext = currentIndex >= 0 && currentIndex < encounters.length - 1;
    console.log('➡️ getNextEncounter:', { 
      encounterId, 
      currentIndex, 
      encountersLength: encounters.length,
      hasNext,
      nextIndex: currentIndex + 1
    });
    
    if (hasNext) {
      const nextEncounter = encounters[currentIndex + 1];
      console.log('✅ Next encounter:', { id: nextEncounter.encounterId, name: nextEncounter.patientName });
      return nextEncounter;
    }
    console.log('❌ No next encounter available');
    return null;
  }, [encounters, getCurrentIndex]);

  const value: EncountersContextType = {
    encounters,
    loading,
    error,
    lastRefresh,
    loadEncounters,
    refreshEncounters,
    getCurrentIndex,
    getPreviousEncounter,
    getNextEncounter
  };

  return (
    <EncountersContext.Provider value={value}>
      {children}
    </EncountersContext.Provider>
  );
};
