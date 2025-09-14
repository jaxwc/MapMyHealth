import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, AccountManager, accountManager } from "../lib/AccountManager";

import { Button } from "./ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export default function SignupForm() {
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      dob: "",
      gender: "male" as "male" | "female",
      heightFeet: "",
      heightInches: "",
      weight: undefined, 
      conditions: "",
    } as const, 
  });

  function onSubmit(values: z.infer<typeof accountSchema>) {
    const accountData = {
      fullName: values.fullName,
      email: values.email,
      password: values.password, // hash in production
      dob: new Date(values.dob),
      gender: values.gender as "male" | "female",
      heightFeet: values.heightFeet === "" ? undefined : Number(values.heightFeet),
      heightInches: values.heightInches === "" ? undefined : Number(values.heightInches),
      weight: values.weight === "" ? undefined : Number(values.weight),
      conditions: values.conditions,
    };

    const newAccount = accountManager.createAccount(accountData);
    console.log("Account created:", newAccount);
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-800 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/10">
      <h2 className="text-xl font-semibold mb-4 text-slate-100">Create Account</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Full Name</FormLabel>
                <FormControl>
                  <Input 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400" 
                    placeholder="John Doe" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Email</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400" 
                    placeholder="you@example.com" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400" 
                    placeholder="••••••••" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Birth */}
          <FormField
            control={form.control}
            name="dob"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Date of Birth</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Gender */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-700 text-slate-200 border-slate-600">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-slate-700 text-slate-200 border-slate-600">
                    <SelectItem value="male" className="text-slate-200">Male</SelectItem>
                    <SelectItem value="female" className="text-slate-200">Female</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Height - Feet and Inches */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="heightFeet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Height (feet)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="8" 
                      placeholder="5" 
                      className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="heightInches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Height (inches)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="11" 
                      placeholder="10" 
                      className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Weight */}
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Weight (lb)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="65" 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Conditions */}
          <FormField
            control={form.control}
            name="conditions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200">Medical Conditions</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="e.g. Asthma, Diabetes" 
                    className="bg-slate-700 text-slate-200 border-slate-600 placeholder:text-slate-400"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full bg-pink-600 text-white hover:bg-pink-500">
            Create Account
          </Button>
        </form>
      </Form>
    </div>
  );
}