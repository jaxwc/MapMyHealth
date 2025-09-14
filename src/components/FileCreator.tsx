'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import PatientProfileService, { PatientData } from '../lib/PatientProfileService';

import { Button } from './ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const patientFormSchema = z.object({
  age: z.coerce.number().positive().int(),
  sexAtBirth: z.enum(['male', 'female', 'other']),
  feet: z.coerce.number().positive().int(),
  inches: z.coerce.number().min(0).max(11).int(),
  weight: z.coerce.number().positive(),
});

type PatientFormData = z.infer<typeof patientFormSchema>;

export default function PatientDataForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      age: undefined,
      sexAtBirth: undefined,
      feet: undefined,
      inches: undefined,
      weight: undefined,
    },
  });

  const onSubmit = (data: PatientFormData) => {
    setIsSubmitting(true);

    const patientData: PatientData = {
      demographics: {
        age: data.age,
        sexAtBirth: data.sexAtBirth,
        height: {
          feet: data.feet,
          inches: data.inches,
        },
        weight: data.weight,
      },
    };

    PatientProfileService.savePatientData(patientData);
    alert('Patient data saved successfully!');
    form.reset();
    setIsSubmitting(false);
  };

  const handleRetrieveData = () => {
    const data = PatientProfileService.getPatientData();
    if (data) {
      console.log('Retrieved Patient Data:', data);
      alert(
        `Retrieved Data:\nAge: ${data.demographics?.age}\nSex: ${data.demographics?.sexAtBirth}\nHeight: ${data.demographics?.height?.feet}'${data.demographics?.height?.inches}\