/**
 * MapMyHealth Patient Health Service
 *
 * Skeleton service for patient data fetching and subscription.
 * Abstracts the data source (EHR, local cache, API).
 */

import type { PatientData } from '../types/health';

export interface PatientHealthServiceInterface {
  fetch(patientId: string): Promise<PatientData>;
  subscribe(patientId: string, onUpdate: (p: PatientData) => void): () => void;
}

/**
 * Mock implementation of PatientHealthService
 * TODO: Replace with actual EHR integration
 */
class PatientHealthServiceImpl implements PatientHealthServiceInterface {
  private mockPatients: Record<string, PatientData> = {
    'patient-001': {
      demographics: { age: 35, sexAtBirth: 'female' },
      vitals: {
        temperature: 99.5,
        heartRate: 85,
        bloodPressure: '120/80'
      },
      labs: {
        whiteBloodCells: 7200,
        hemoglobin: 13.8
      },
      history: {
        allergies: ['penicillin'],
        chronicConditions: []
      },
      medications: ['multivitamin'],
      allergies: ['penicillin']
    },
    'patient-002': {
      demographics: { age: 42, sexAtBirth: 'male' },
      vitals: {
        temperature: 98.6,
        heartRate: 72,
        bloodPressure: '125/82'
      },
      labs: {},
      history: {
        chronicConditions: ['hypertension'],
        familyHistory: ['diabetes', 'heart disease']
      },
      medications: ['lisinopril 10mg'],
      allergies: []
    },
    'patient-003': {
      demographics: { age: 28, sexAtBirth: 'female' },
      vitals: {},
      labs: {},
      history: {},
      medications: [],
      allergies: []
    }
  };

  async fetch(patientId: string): Promise<PatientData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const patientData = this.mockPatients[patientId];
    if (!patientData) {
      throw new Error(`Patient ${patientId} not found`);
    }

    console.log(`[PatientHealthService] Fetched data for patient: ${patientId}`);
    return { ...patientData }; // Return copy to avoid mutations
  }

  subscribe(patientId: string, onUpdate: (p: PatientData) => void): () => void {
    console.log(`[PatientHealthService] Subscribing to updates for patient: ${patientId}`);

    // Mock subscription - in real implementation, this would connect to
    // EHR streaming API, WebSocket, Server-Sent Events, etc.

    // Simulate occasional updates
    const interval = setInterval(async () => {
      try {
        const updatedData = await this.fetch(patientId);
        // Add small random changes to simulate real updates
        if (Math.random() < 0.1) { // 10% chance of update
          const vitals = { ...updatedData.vitals };
          if (vitals.temperature) {
            vitals.temperature = Number(vitals.temperature) + (Math.random() - 0.5) * 0.2;
          }
          onUpdate({ ...updatedData, vitals });
        }
      } catch (error) {
        console.error(`[PatientHealthService] Error in subscription for ${patientId}:`, error);
      }
    }, 30000); // Check every 30 seconds

    // Return unsubscribe function
    return () => {
      console.log(`[PatientHealthService] Unsubscribing from patient: ${patientId}`);
      clearInterval(interval);
    };
  }
}

/**
 * Export singleton instance
 */
export const PatientHealthService: PatientHealthServiceInterface = new PatientHealthServiceImpl();

/**
 * Utility function to get list of available mock patients
 */
export function getAvailableMockPatients(): Array<{ id: string; name: string; demographics: any }> {
  return [
    {
      id: 'patient-001',
      name: 'Sarah Johnson',
      demographics: { age: 35, sexAtBirth: 'female' }
    },
    {
      id: 'patient-002',
      name: 'Michael Chen',
      demographics: { age: 42, sexAtBirth: 'male' }
    },
    {
      id: 'patient-003',
      name: 'Emma Williams',
      demographics: { age: 28, sexAtBirth: 'female' }
    }
  ];
}