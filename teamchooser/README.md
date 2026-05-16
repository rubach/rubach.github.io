# Random Team Chooser Web App

A tiny web application for choosing random teams for a game.

This small web app will randomly pick teams for a 


## Agent Instructions

This is a tiny web app for choosing random teams for a people playing in a video game tournament. For example, there could be 4 people playing in a Tecmo Super Bowl tournament, and the app will randomly pick teams for each person. To start with, focus on building this app for randomly assigning teams for Tecmo Super Bowl. Eventually, it should support multiple video games (like Tecmo Super Bowl, RBI Baseball, etc.) and allow users to select which game they are playing. It is a single page application and does not use a framework. Focus on using this app on a phone, not a desktop computer. The UI should be optimized for a phone screen in portrait mode. 

When a user first loads the app, they will have the following options:

1. Number of people (1-28)
2. People's names (dynamically generated text fields based on the number of people, default value for each field is 'Player 1', 'Player 2', etc.)
3. What video game are they playing? (select field, this will be a prepopulated list of video games, like Tecmo Super Bowl, RBI Baseball, etc.)
4. Allow for the same team to be selected multiple times? (checkbox, default value is unchecked)
5. Exclude Teams? (checkbox, default value is unchecked, if checked, it will show a list of teams to exclude based on the game selected, allow for multiple exclusions of teams)

After all the options are selected, there will be a button that says "Start the Spinning!". 

After the button is pressed, the page will display a single slot machine wheel with the teams from the game selected listed on it (exluding any teams that are in the exclusion list). The person's name will be displayed above the wheel. This will be the first person's team. Tapping on the screen will cause the wheel to spin and land on a random team for that person. After the team is selected, the next person's team will be displayed on a new wheel, and so on until all people have a team selected.

After the spinning is done for all players, a summary page will be displayed showing each player and their selected team. There will be a "Reset" button that will allow the user to start over.
