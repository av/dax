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
- The user must be able to interact with the objects, which represent files and folders, by moving them around, opening them, or throwing them.
- Folders must be represented as containers that can hold other objects, while files must be represented as individual objects that can be opened or manipulated.
- The app must reflect changes in the filesystem in real-time, such as creating, deleting, or modifying files and folders, and these changes must be visually represented in the 3D environment.
- The app must allow users to perform basic file operations, such as creating new files or folders, renaming them, moving them around, and deleting them, all through interactions with the 3D objects.
- The app must provide a way to visualize file metadata, such as file size, type, and modification date, through interactions with the objects or by displaying information panels.
- The app must allow users to search for specific files or folders by name or content, and the search results should be highlighted in the 3D environment.
- App should automatically arrange the objects in a way that minimizes clutter and maximizes accessibility, with a force-directed layout using actual D3 for layout calculations.
- The app must use a physics engine to simulate realistic interactions between the objects, such as collisions and gravity.
- The workspace must host an agent based on OpenCode SDK that can perform various tasks related to the files, has agency to move around
- The agent must not be a chatbot, but rather an entity with its own mind, goals and personality. It must be able to start doing something useful without being prompted by the user, and it must be able to learn from the user's interactions and adapt its behavior accordingly.
- It should be possible to configure the app to use a custom LLM with OpenAI-compatible API URL/key, configure custom embeddings URL/key.
- The app must provide a way to visualize the agent's thought process, such as displaying its current goals, plans, and actions in a dedicated panel or through interactions with the agent object in the 3D environment.
- The app must be designed with a modular architecture that allows for easy extension and customization, such as adding new types of objects, interactions, or agent capabilities without requiring significant changes to the existing codebase.
- The app should be optimized for performance, ensuring smooth interactions and rendering even with a large number of files and folders in the 3D environment.
- The app must have nice aesthetics and a user-friendly interface that makes it easy for users to navigate and interact with their files in the 3D environment.