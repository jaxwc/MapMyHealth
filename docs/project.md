This project presents a novel method for recommending a patient with next steps to getting healthy based on their current symptoms and predicted conditions based on those symptoms.

We rely on a simulated/fake dataset running our "condition predictor model" based on patient data, symptoms, and test results (findings). In the future, this dataset would be build based on real diagnoses and medical data collected from hospitals and patients -- which we do not have access to at this time.
- Future dataset inspiration: [](https://github.com/amMistic/Diseases-Prediction-based-on-Symptoms)

We also map actions that a patient can take (tests, monitoring, treatment) that produce outcomes affecting known findings. These actions are simulated based on the patient's current state to determine the quickest path to condition certainty (which tests or actions reveal the patient's health outcome the quickest)?

This action map is displayed for the user to visualize their care/treatment options based on their current situation and possible futures.