This project presents a novel method for recommending a patient with next steps to getting healthy based on their current symptoms and predicted conditions based on those symptoms.

We rely on a simulated/fake dataset running our "condition predictor model" based on patient data, symptoms, and test results (findings). In the future, this dataset would be build based on real diagnoses and medical data collected from hospitals and patients -- which we do not have access to at this time.
- Future dataset inspiration: [](https://github.com/amMistic/Diseases-Prediction-based-on-Symptoms)

We also map actions that a patient can take (tests, monitoring, treatment) that produce outcomes affecting known findings. These actions are simulated based on the patient's current state to determine the quickest path to condition certainty (which tests or actions reveal the patient's health outcome the quickest)?

This action map is displayed for the user to visualize their care/treatment options based on their current situation and possible futures.

## Inspiration
We wanted to make healthcare more accessible and visual. Too often, people ignore early symptoms or waste time trying to figure out whether to see a doctor because the map of possible healthcare is vast. Our goal was to create a tool that helps people better understand their health, their options, and visualize the best possible courses of action that lead to better diagnoses and treatment.

## What it does

In short, we built a much better form of WebMD with helpful AI insights based on real data.

MapMyHealth has 2 modes of interaction with a patient in the app. The first is an AI chat interface to an agent with access to the patient's previous data and our application layer for creating treatment and medical action recommentations.
1. The user describes their medical situation
2. The AI splits the situation into symptoms and test reults
3. These findings are passed to the application, whcih runs the patient's data through a predictor model
4. The model produces probabilities for medical conditions that the patient may have, treatment options for each, and recommended next steps to take.
5. The agent uses this information to give the user an informed recommendation of their options. It can also display data straight from the engine to show them multiple option paths that they can take.

The second mode of interaction is the "Health Analysis" view. This is the data that the agent has access to, in the patient's hands as well! The patient can view the medical chart that the agent is building and modify it to make it as accurate as possible. The recommendations update in real time as the patient adds information, making it a human+AI collaborative experience!

## How we built it
MapMyHealth is built in 3 parts: A medical condition predictor engine, an interactive form for visualizing engine results and recommended medical paths (think WebMD), and finally an agentic AI with the tools it needs to interact with both the patient and the engine to deliver accurate medical analyis (more accurate than just a chatbot, not a real doctor).

We built a custom engine for predicting possible medical conditions based on a list of symptoms and test results. This engine was inspired by bayesian statisticical models for calculating beliefs, in our case toward given medical conditions. The dataset powering this predictor model was custom written by us and generative AI to simulate 30 conditions and their symptoms. In the future, a regressor model would be crucial based on real health data, which we do not have access to. Inspiration: https://github.com/amMistic/Diseases-Prediction-based-on-Symptoms

Our healthcare map is the second piece and a product of the predictor engine. Given a set of symptoms and probabilities of likely medical conditions, the engine determines multiple action paths that the patient can take to increase diagnosis certainty. These actions are based on custom rules that we built, later driven by medical providers recommended steps. The result is a simple map showing the user a few options that they have and the outcome that those actions could yield them.

Finally, the agentic AI layer serves as a comfortable method for our user to interact with our app. Similarly to a real healthcare provider, the agent is trained to investigate the patient's health state and record symptoms and other data, feeding straight into the predictor engine. The agent can then read back predictions and recommended action paths, referencing these sources to provide the user with useful recommendations. The agent is also programmed to recognize red flags from the engine based on the patient's condition to correctly inform them to schedule a doctor's visit or immediately seek urgent care.

### Tech Stack
- **App:** Next.js, TypeScript, React, Shadcn, TailwindCSS, LibSQL
- **Map Diagrams:** Mermaid Charts
- **AI Agent:** Google Gemini API + Mastra Agentic Framework

## Challenges we ran into
1. Building the predictor engine was difficult in both concept and implementation. We did a lot of brainstorming and researching before comming up with an MVP version.
2. Implementing Gemini as an agent without using Google ADK (only in python and java) was a challenge requiring us to learn new libraries. We are proud to get it working!
3. Visualizing a patient's health journey was the most difficult of all, due to the sheer number of options available for treatment, specialists, and tests. We eventually settled on an algorithm that ranks health actions based on the most impact to the diagnosis, trying to obtain certainty by eliminating options.

## Accomplishments that we're proud of
1. Building cost into the mapping model! Along with the options and outcomes, the user can see the estimated price of each step, such as a doctor's visit or procedure. People that already have enough uncertainty over their options, but many also live with the uncertainty of how much healthcare will cost before they can get a definitive answer! If our MVP was fully realized, this would add a lot of value and transparency to the healthcare space.
2. We are proud to have sticked to the cyberpunk theme! ;)
3. Solving a real healthcare problem with novel technology that we do not believe exists.

## What we learned

## What's next for MapMyHealth
The ultimate goal of this project would be to build a full map showing the patient's current health and all unknowns that they can still explore. What options do they have for their weird back pain? Map it out! What should they be worrying about as they age? Map it out!

We believe that this project could be a foundation for gamifying healthcare. When people understand the rules and their options, they will 
