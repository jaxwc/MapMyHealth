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

const mockPatientsData: Record<string, PatientData> = {
    'patient-001': {
      demographics: { age: 35, sexAtBirth: 'female', height: { feet: 5, inches: 4 }, weight: 140 },
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
      demographics: { age: 42, sexAtBirth: 'male', height: { feet: 6, inches: 0 }, weight: 210 },
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
      demographics: { age: 28, sexAtBirth: 'female', height: { feet: 5, inches: 7 }, weight: 120 },
      vitals: {},
      labs: {},
      history: {
        chronicConditions: []
      },
      medications: [],
      allergies: []
    }
  };

const availableMockPatients: Array<{ id: string; name: string; demographics: any; dob: string; history: { chronicConditions: string[] }; medications: string[]; allergies: string[]; }> = [
    {
      id: 'patient-001',
      name: 'Sarah Johnson',
      demographics: { age: 35, sexAtBirth: 'female', height: { feet: 5, inches: 4 }, weight: 140 },
      dob: '1990-05-15',
      history: {
        chronicConditions: []
      },
      medications: ['multivitamin'],
      allergies: ['penicillin']
    },
    {
      id: 'patient-002',
      name: 'Michael Chen',
      demographics: { age: 42, sexAtBirth: 'male', height: { feet: 6, inches: 0 }, weight: 210 },
      dob: '1983-10-20',
      history: {
        chronicConditions: ['hypertension']
      },
      medications: ['lisinopril 10mg'],
      allergies: []
    },
    {
      id: 'patient-003',
      name: 'Emma Williams',
      demographics: { age: 28, sexAtBirth: 'female', height: { feet: 5, inches: 7 }, weight: 120 },
      dob: '1997-02-28',
      history: {
        chronicConditions: []
      },
      medications: [],
      allergies: []
    }
  ];

/**
 * Mock implementation of PatientHealthService
 * TODO: Replace with actual EHR integration
 */
class PatientHealthServiceImpl implements PatientHealthServiceInterface {
  private mockPatients: Record<string, PatientData> = mockPatientsData;

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
export function getAvailableMockPatients(): Array<{ id: string; name: string; demographics: any; dob: string; history: { chronicConditions: string[] }; medications: string[]; allergies: string[]; }> {
  return availableMockPatients;
}

/**
 * Utility function to add a new mock patient
 */
export function addPatient(patient: { name: string; dob: string; sexAtBirth: "male" | "female" | "other"; history: string; medications: string; allergies: string; heightFeet: number; heightInches: number; weight: number; }): { id: string; name: string; demographics: any; dob: string; } {
  const newId = `patient-00${availableMockPatients.length + 4}`;
  const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
  const newPatient = {
    id: newId,
    name: patient.name,
    demographics: { age, sexAtBirth: patient.sexAtBirth, height: { feet: patient.heightFeet, inches: patient.heightInches }, weight: patient.weight },
    dob: patient.dob,
    history: { chronicConditions: patient.history.split(',').map(s => s.trim()).filter(Boolean) },
    medications: patient.medications.split(',').map(s => s.trim()).filter(Boolean),
    allergies: patient.allergies.split(',').map(s => s.trim()).filter(Boolean),
  };
  
  availableMockPatients.push(newPatient);
  
  mockPatientsData[newId] = {
    demographics: { age, sexAtBirth: patient.sexAtBirth, height: { feet: patient.heightFeet, inches: patient.heightInches }, weight: patient.weight },
    history: { chronicConditions: newPatient.history.chronicConditions },
    medications: newPatient.medications,
    allergies: newPatient.allergies,
    vitals: {},
    labs: {},
  };

  return newPatient;
}

/**
 * Utility function to delete a mock patient
 */
export function deletePatient(patientId: string) {
  const index = availableMockPatients.findIndex(p => p.id === patientId);
  if (index > -1) {
    availableMockPatients.splice(index, 1);
  }
  delete mockPatientsData[patientId];
}

/**
 * Utility function to update a mock patient
 */
export function updatePatient(patientId: string, data: { name: string, dob: string, sexAtBirth: "male" | "female" | "other"; history: string; medications: string; allergies: string; heightFeet: number; heightInches: number; weight: number; }) {
  const patient = availableMockPatients.find(p => p.id === patientId);
  if (patient) {
    patient.name = data.name;
    patient.dob = data.dob;
    const age = new Date().getFullYear() - new Date(data.dob).getFullYear();
    patient.demographics.age = age;
    patient.demographics.sexAtBirth = data.sexAtBirth;
    patient.demographics.height = { feet: data.heightFeet, inches: data.heightInches };
    patient.demographics.weight = data.weight;
    patient.history.chronicConditions = data.history.split(',').map(s => s.trim()).filter(Boolean);
    patient.medications = data.medications.split(',').map(s => s.trim()).filter(Boolean);
    patient.allergies = data.allergies.split(',').map(s => s.trim()).filter(Boolean);
    
    if (mockPatientsData[patientId]) {
        mockPatientsData[patientId].demographics.age = age;
        mockPatientsData[patientId].demographics.sexAtBirth = data.sexAtBirth;
        mockPatientsData[patientId].demographics.height = { feet: data.heightFeet, inches: data.heightInches };
        mockPatientsData[patientId].demographics.weight = data.weight;
        mockPatientsData[patientId].history = { chronicConditions: patient.history.chronicConditions };
        mockPatientsData[patientId].medications = patient.medications;
        mockPatientsData[patientId].allergies = patient.allergies;
    }
  }
}
