# Free Secure Code

[My Notes](notes.md)

This is a web application that allows users to upload a folder of code, analyzes it using the OpenAI GPT API, and provides insights into potential vulnerabilities and suggestions for improvement. This tool is designed to implement simple, fast, and secure code analyisis using the latest AI technologies.

## 🚀 Specification Deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [x] Proper use of Markdown
- [x] A concise and compelling elevator pitch
- [x] Description of key features
- [x] Description of how you will use each technology
- [x] One or more rough sketches of your application. Images must be embedded in this file using Markdown image references.

### Elevator pitch

Have you ever wanted to know if your code is secure? Code Vulnerability Analyzer is a simple web tool that enables developers to identify and resolve security vulnerabilities in a matter of seconds. By uploading a folder containing your code, you can receive detailed AI reports, highlighting weaknesses and providing some recommendations for improvement. Whether you're working on a small project or a large-scale application, this tool ensures your code meets high-security standards.

### Design

![Design image](design.png)

Here is a conceptual design of the workflow:
1. Users upload a compressed folder of their code.
2. The server extracts its contents and processes each file.
3. The OpenAI GPT API is used to analyze the files for vulnerabilities.
4. Results are displayed on a dashboard.

```mermaid
sequenceDiagram
    actor User
    actor WebApp
    User->>WebApp: Upload a ZIP folder
    WebApp->>Server: Send the folder to the server
    Server->>GPT_API: Analyze code files
    GPT_API-->>Server: Return vulnerability analysis
    Server-->>WebApp: Send results to display
    WebApp-->>User: Show vulnerability insights and suggestions
```

### Key features

- Secure Upload: Users can upload a compressed folder containing their codebase securely.
- AI-Powered Analysis: The application integrates with the OpenAI GPT API to analyze the code for common vulnerabilities, such as SQL injection, XSS, and weak encryption.
- Detailed Reports: Generates actionable suggestions for improving code security.
- Dashboard: Allows users to explore vulnerabilities file by file, with severity ratings and improvement tips.
- Real-Time Feedback: Uses WebSocket to show the progress of analysis as it happens.

### Technologies

I am going to use the required technologies in the following ways.

- **HTML** - Uses correct HTML structure for application. Two HTML pages. One for login and one for the code analyzer dashboard.
- **CSS** - Application styling that looks good on different screen sizes, uses good whitespace, color choice and contrast.
- **React** - Provides login, file uploads, real-time analysis progress, and report displays.
- **Service** - Integrates the OpenAI GPT API for analyzing code files.
Uses third-party libraries for handling ZIP file uploads and extraction.
- **DB/Login** - Implements user authentication for secure access to the application.
Stores user-uploaded files and analysis history in a database for reference.
- **WebSocket** - Provides real-time feedback to users during the analysis process, such as displaying progress and results as they are generated.

## 🚀 AWS deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [X] **Server deployed and accessible with custom domain name** - [My server link](https://getsecurecode.com).

## 🚀 HTML deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [X] **HTML pages**
- [X] **Proper HTML element usage**
- [X] **Links**
- [X] **Text**
- [X] **3rd party API placeholder**
- [X] **Images**
- [X] **Login placeholder**
- [X] **DB data placeholder**
- [X] **WebSocket placeholder**

## 🚀 CSS deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [X] **Header, footer, and main content body** - I did not complete this part of the deliverable.
- [X] **Navigation elements** - I did not complete this part of the deliverable.
- [X] **Responsive to window resizing** - I did not complete this part of the deliverable.
- [X] **Application elements** - I did not complete this part of the deliverable.
- [X] **Application text content** - I did not complete this part of the deliverable.
- [X] **Application images** - I did not complete this part of the deliverable.

## 🚀 React part 1: Routing deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [X] **Bundled using Vite** - I did complete this part of the deliverable.
- [X] **Components** - I did complete this part of the deliverable.
- [X] **Router** - Routing between login and voting components.

## 🚀 React part 2: Reactivity

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [X] **All functionality implemented or mocked out** - I did not complete this part of the deliverable.
- [X] **Hooks** - I did not complete this part of the deliverable.

## 🚀 Service deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [ ] **Node.js/Express HTTP service** - I did not complete this part of the deliverable.
- [ ] **Static middleware for frontend** - I did not complete this part of the deliverable.
- [ ] **Calls to third party endpoints** - I did not complete this part of the deliverable.
- [ ] **Backend service endpoints** - I did not complete this part of the deliverable.
- [ ] **Frontend calls service endpoints** - I did not complete this part of the deliverable.

## 🚀 DB/Login deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [ ] **User registration** - I did not complete this part of the deliverable.
- [ ] **User login and logout** - I did not complete this part of the deliverable.
- [ ] **Stores data in MongoDB** - I did not complete this part of the deliverable.
- [ ] **Stores credentials in MongoDB** - I did not complete this part of the deliverable.
- [ ] **Restricts functionality based on authentication** - I did not complete this part of the deliverable.

## 🚀 WebSocket deliverable

For this deliverable I did the following. I checked the box `[x]` and added a description for things I completed.

- [ ] **Backend listens for WebSocket connection** - I did not complete this part of the deliverable.
- [ ] **Frontend makes WebSocket connection** - I did not complete this part of the deliverable.
- [ ] **Data sent over WebSocket connection** - I did not complete this part of the deliverable.
- [ ] **WebSocket data displayed** - I did not complete this part of the deliverable.
- [ ] **Application is fully functional** - I did not complete this part of the deliverable.
