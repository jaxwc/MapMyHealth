import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { useState } from "react";
import { addPatient } from "@/app/services/PatientHealthService";

interface AddPatientFormProps {
  onClose: () => void;
  onPatientAdded: () => void;
}

export default function AddPatientForm({ onClose, onPatientAdded }: AddPatientFormProps) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sexAtBirth, setSexAtBirth] = useState<"male" | "female" | "other" | "">("");
  const [heightFeet, setHeightFeet] = useState<number | string>("");
  const [heightInches, setHeightInches] = useState<number | string>("");
  const [weight, setWeight] = useState<number | string>("");
  const [history, setHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dob || !sexAtBirth) return;
    addPatient({ name, dob, sexAtBirth, history, medications, allergies, heightFeet: Number(heightFeet), heightInches: Number(heightInches), weight: Number(weight) });
    onPatientAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-slate-100">Add Patient</h2>
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
            <Button type="submit">Add Patient</Button>
          </div>
        </form>
      </div>
    </div>
  );
}