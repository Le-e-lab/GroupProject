🌐 Project Name: Paden
Welcome to the team! This guide will help you get your local environment set up and explain how we work together using GitHub and VS Code.

🛠 1. Getting Started
Download the Files
To get the code onto your computer, we use Git. This allows us to work on the same files without overwriting each other's work.

Open VS Code.

Press Ctrl + Shift + P (or Cmd + Shift + P on Mac) and type "Git: Clone".

Paste our repository URL: https://github.com/username/repository-name.git

Choose a folder on your computer to save it in.

Required VS Code Extensions
To make development easier, please install these from the Extensions tab (Ctrl + Shift + X):

Live Server: Allows you to right-click index.html and select "Open with Live Server" to see your changes instantly in the browser.

Prettier - Code formatter: Ensures our code looks the same regardless of who wrote it.

ESLint: Highlights errors in your JavaScript while you type.

📦 2. Installing Dependencies
We use NPM (Node Package Manager) to manage our libraries.

Open the terminal in VS Code (Terminal > New Terminal).

Run the following command:

Bash

npm install
This will look at the package.json file and download everything the project needs into a folder called node_modules.

🌿 3. Our Workflow (How to contribute)
Rule #1: Never work directly on the main branch. This keeps our "live" code from breaking.

How to create a Branch
In the bottom-left corner of VS Code, click where it says main.

Select "Create new branch..." from the top menu.

Name your branch using this format: name/feature-description (e.g., simba/add-contact-form).

How to save and share your work
Once you've made changes:

Go to the Source Control tab on the left (or press Ctrl + Shift + G).

Click the + icon next to your files to "Stage" them.

Type a clear message (e.g., "Added CSS styling to navigation bar") in the box and click Commit.

Click Sync Changes (or Publish Branch) to send your code to GitHub.

💡 Pro-Tips
Pull before you start: Every time you start working, run git pull to get the latest changes from your teammates.

Inspect Element: Use F12 in your browser to debug your CSS and see JavaScript errors in the Console.
