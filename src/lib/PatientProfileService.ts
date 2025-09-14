
export interface PatientData {
  demographics?: {
    age?: number;
    sexAtBirth?: "male" | "female" | "other";
    height?: {
      feet: number;
      inches: number;
    };
    weight?: number;
  };
  vitals?: Record<string, number | string>;
  labs?: Record<string, number | string>;
  history?: Record<string, unknown>;
  medications?: string[];
  allergies?: string[];
}

class PatientProfileService {
  private static readonly STORAGE_KEY = 'patientData';

  static savePatientData(data: PatientData): void {
    try {
      const serializedData = JSON.stringify(data);
      localStorage.setItem(PatientProfileService.STORAGE_KEY, serializedData);
      console.log("Patient data saved successfully.");
    } catch (error) {
      console.error("Error saving patient data:", error);
    }
  }

  static getPatientData(): PatientData | null {
    try {
      const serializedData = localStorage.getItem(PatientProfileService.STORAGE_KEY);
      if (serializedData === null) {
        return null;
      }
      const data: PatientData = JSON.parse(serializedData);
      console.log("Patient data retrieved successfully.");
      return data;
    } catch (error) {
      console.error("Error retrieving patient data:", error);
      return null;
    }
  }
}

export default PatientProfileService;

// Simple demonstration of how to store and retrieve patient data
const demonstration = () => {
  console.log("--- Running PatientProfileService Demonstration ---");

  // 1. Create sample patient data
  const newPatientData: PatientData = {
    demographics: {
      age: 45,
      sexAtBirth: "male",
      height: {
        feet: 5,
        inches: 11
      },
      weight: 180
    },
    vitals: {
      "bloodPressure": "120/80",
      "heartRate": 75
    },
    medications: ["Lisinopril", "Aspirin"],
    allergies: ["Penicillin"]
  };

  // 2. Store the patient data
  PatientProfileService.savePatientData(newPatientData);

  // 3. Retrieve the patient data
  const retrievedPatientData = PatientProfileService.getPatientData();

  // 4. Log the retrieved data to show it works
  if (retrievedPatientData) {
    console.log("Retrieved Patient Data:", retrievedPatientData);
    console.log(
      `Height: ${retrievedPatientData.demographics?.height?.feet} feet, ${retrievedPatientData.demographics?.height?.inches} inches`
    );
    console.log(`Weight: ${retrievedPatientData.demographics?.weight} lbs`);
  } else {
    console.log("No patient data found.");
  }

  console.log("--- End of Demonstration ---");
};

// To run the demonstration, you could call demonstration() in a suitable place,
// for example, in a development-only section of your app or a test file.
// demonstration();
