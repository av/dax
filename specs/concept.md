# DAX

A desktop app that mirrors a filesystem in a specified directory but as a set of 3D objects in a physics-based environment. The user can interact with the objects, which represent files and folders, by moving them around, opening them, or even throwing them. The app would use a physics engine to simulate realistic interactions between the objects, such as collisions and gravity.

The workspace also hosts an agent based on OpenCode SDK that can perform various tasks related to the files, has agency to move around the workspace, and can interact with the user. The distinct feature of the agent is that it's not a chatbot, but rather an entity with its own mind, goals and personality. The agent can be trained to perform specific tasks, such as organizing files, searching for specific content, or even creating new files based on user input. The agent can also learn from the user's interactions and adapt its behavior accordingly.

The environment is also used as a UX testbed for advancing digital workspace design for agentic era with unique affordances and interaction patterns that leverage the spatial and physical nature of the environment. The app can be used for various purposes, such as file management, productivity, creativity, and even entertainment.

# Tech Stack

- Electron for desktop app development
- Actual lightweight game engine for 3D environment
- Solid.js for flat GUI
- OpenCode SDK as an agent runtime
- Turso as a local-first DB

# Features

- The app must mirror the filesystem in a specified directory as 3D objects in a physics-based environment.
- User can select a directory on their filesystem and app must remember this selection for the next sessions. The app should also provide a way to change the selected directory if needed.
- The user must be able to interact with the objects, which represent files and folders, by moving them around, opening them, or throwing them.
- Folders must be represented as containers that can hold other objects, while files must be represented as individual objects that can be opened or manipulated.
- The app must reflect changes in the filesystem in real-time, such as creating, deleting, or modifying files and folders, and these changes must be visually represented in the 3D environment. App should use same system as VS Code.
- The app must only store what it can't get from the filesystem: scene positions, agent state, and other metadata that is not already stored in the filesystem. The app should not duplicate any data that is already present in the filesystem, and it should rely on the filesystem as the single source of truth for file and folder information.
- The app must allow users to open files by interacting with the corresponding objects in the 3D environment, and the files should be opened in their default applications or in a built-in viewer if applicable.
- The app must allow users to perform basic file operations, such as creating new files or folders, renaming them, moving them around, and deleting them, all through interactions with the 3D objects.
- The app must provide a way to visualize file metadata, such as file size, type, and modification date, through interactions with the objects or by displaying information panels.
- The app must allow users to search for specific files or folders by name or content, and the search results should be highlighted in the 3D environment.
- App should automatically arrange the objects in a way that minimizes clutter and maximizes accessibility, with a force-directed layout using actual D3 for layout calculations.
- The app must use a physics engine to simulate realistic interactions between the objects, such as collisions and gravity.
- The workspace must host an agent based on OpenCode SDK that can perform various tasks related to the files, has agency to move around the workspace, and can interact with the user at will.
- The agent must not be a chatbot, but rather an entity with its own mind, goals and personality. It must be able to start doing something useful without being prompted by the user, and it must be able to learn from the user's interactions and adapt its behavior accordingly.
- It should be possible to configure the app to use a custom LLM with OpenAI-compatible API URL/key, configure custom embeddings URL/key.
- The app must provide a way to visualize the agent's thought process, such as displaying its current goals, plans, and actions in a dedicated panel or through interactions with the agent object in the 3D environment.
- The app must be designed with a modular architecture that allows for easy extension and customization, such as adding new types of objects, interactions, or agent capabilities without requiring significant changes to the existing codebase.
- The app should be optimized for performance, ensuring smooth interactions and rendering even with a large number of files and folders in the 3D environment.
- The app must have nice aesthetics and a user-friendly interface that makes it easy for users to navigate and interact with their files in the 3D environment.
- App uses lightweight signal-based state management that can be used both in the 3D environment and the flat GUI, allowing for seamless integration between the two and ensuring that changes in one are reflected in the other in real-time.
- RTS-style camera controls for navigating the 3D environment, allowing users to easily pan, zoom, and rotate their view of the workspace.
- Input mode is based on mouse and keyboard, with support for drag-and-drop interactions for moving files and folders around the workspace, as well as keyboard shortcuts for common file operations and agent interactions.
- Basic soft lighting and shadows in the 3D environment to enhance the visual appeal and provide better depth perception for the objects representing files and folders.
- Agent autonomy is based on the Belief-Desire-Intention (BDI) model, allowing the agent to have its own beliefs about the state of the workspace, desires that drive its behavior, and intentions that guide its actions towards achieving its goals. Seed the agent with some initial beliefs and desires related to file management tasks, such as keeping the workspace organized, finding specific files when requested, and learning from user interactions to improve its performance over time.
- Agent learning is essentially remembering some instructions in the application database, each instruction with a "trigger" or a "query" that can be matched against specific situations or user inputs. When the agent detects a trigger or receives a query that matches one of the stored instructions, it can execute the corresponding action or behavior. This allows the agent to learn from user interactions and adapt its behavior based on past experiences, improving its performance over time in assisting with file management tasks and other interactions within the workspace.
- User can ask agent to perform a task, such as "organize my files by type" or "find the latest version of the report", and the agent can execute the corresponding actions in the 3D environment, such as grouping files by type or searching for files with specific criteria. The agent can also provide feedback to the user about its actions and the results, such as displaying a message in the interface or highlighting the relevant files in the workspace.
- All of the agent's actions in 3D space are animated, allowing to visually track what the agent is doing.
- All of the agent's actions are logged in the app's database.