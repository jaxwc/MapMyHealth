import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { useState, useEffect } from "react";
import { updatePatient } from "@/app/services/PatientHealthService";

interface EditPatientFormProps {
  patient: {
    id: string;
    name: string;
    dob: string;
    demographics: {
        sexAtBirth?: "male" | "female" | "other";
        height?: {
            feet: number;
            inches: number;
        };
        weight?: number;
    };
    history: {
        chronicConditions: string[];
    };
    medications: string[];
    allergies: string[];
  };
  onClose: () => void;
}

export default function EditPatientForm({ patient, onClose }: EditPatientFormProps) {
  const [name, setName] = useState(patient.name);
  const [dob, setDob] = useState(patient.dob);
  const [sexAtBirth, setSexAtBirth] = useState(patient.demographics?.sexAtBirth || "");
  const [heightFeet, setHeightFeet] = useState(patient.demographics?.height?.feet || "");
  const [heightInches, setHeightInches] = useState(patient.demographics?.height?.inches || "");
  const [weight, setWeight] = useState(patient.demographics?.weight || "");
  const [history, setHistory] = useState(patient.history?.chronicConditions?.join(", ") || "");
  const [medications, setMedications] = useState(patient.medications?.join(", ") || "");
  const [allergies, setAllergies] = useState(patient.allergies?.join(", ") || "");

  useEffect(() => {
    setName(patient.name);
    setDob(patient.dob);
    setSexAtBirth(patient.demographics?.sexAtBirth || "");
    setHeightFeet(patient.demographics?.height?.feet || "");
    setHeightInches(patient.demographics?.height?.inches || "");
    setWeight(patient.demographics?.weight || "");
    setHistory(patient.history?.chronicConditions?.join(", ") || "");
    setMedications(patient.medications?.join(", ") || "");
    setAllergies(patient.allergies?.join(", ") || "");
  }, [patient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dob || !sexAtBirth) return;
    updatePatient(patient.id, { name, dob, sexAtBirth, history, medications, allergies, heightFeet: Number(heightFeet), heightInches: Number(heightInches), weight: Number(weight) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-slate-100">Edit Patient</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-200">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" />
            </div>
            <div>
              <Label htmlFor="dob" className="text-slate-200">Date of Birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" />
            </div>
            <div>
              <Label htmlFor="sex" className="text-slate-200">Sex at Birth</Label>
              <Select onValueChange={(value) => setSexAtBirth(value as any)} value={sexAtBirth}>
                <SelectTrigger id="sex" className="bg-slate-700 text-slate-200 border-slate-600">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="height-ft" className="text-slate-200">Height (ft)</Label>
                    <Input id="height-ft" type="number" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" />
                </div>
                <div>
                    <Label htmlFor="height-in" className="text-slate-200">Height (in)</Label>
                    <Input id="height-in" type="number" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" />
                </div>
            </div>
            <div>
                <Label htmlFor="weight" className="text-slate-200">Weight (lbs)</Label>
                <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" />
            </div>
            <div>
              <Label htmlFor="history" className="text-slate-200">Previous Medical Conditions</Label>
              <Textarea id="history" value={history} onChange={(e) => setHistory(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" placeholder="Comma-separated conditions..." />
            </div>
            <div>
              <Label htmlFor="medications" className="text-slate-200">Medications</Label>
              <Textarea id="medications" value={medications} onChange={(e) => setMedications(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" placeholder="Comma-separated medications..." />
            </div>
            <div>
              <Label htmlFor="allergies" className="text-slate-200">Allergies</Label>
              <Textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="bg-slate-700 text-slate-200 border-slate-600" placeholder="Comma-separated allergies..." />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <Button type="button" onClick={onClose} variant="outline">Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}