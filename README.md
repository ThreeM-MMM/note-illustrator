# Note Illustrator for Obsidian

This is a plugin for Obsidian.md designed to help Game Masters (GMs) and players automatically generate art for characters, locations, and items.

The plugin reads the text under a **user-defined heading** (e.g., `# Description`) in your active note, sends it to **OpenAI (DALL-E 3)**, and then automatically replaces a specified placeholder image in that note with the newly generated art.

## 🚀 Features

* **AI Art Generation:** Generates high-quality images directly in your notes using **OpenAI (DALL-E 3)**.
* **Regenerate Function:** If no placeholder is found, the plugin automatically finds the *last generated image* and targets it for regeneration.
* **Confirmation Modal:** Asks for a "Yes/No" confirmation before regenerating an existing image to prevent accidents.
* **Optional Auto-Delete:** Can be configured to automatically move the old, replaced image to the system trash upon regeneration.
* **Optional "Smart Sizing":** Reads the dimensions of your placeholder image (e.g., `599x598`) and automatically embeds the new, high-resolution image with the *exact same dimensions* (`![[...|599x598]]`).
* **Configurable Prompt Source:**
    * **Custom Heading:** Define exactly which Markdown heading the plugin should read from (e.g., `#`, `##`).
    * **Custom Heading Text:** Define the heading text to search for (e.g., `Description`, `Appearance`).
* **Advanced Prompt Control:**
    * **Prompt Prefix:** Add a global, customizable style prefix (e.g., "A detailed fantasy portrait of:") to all your prompts from the settings.
    * **Robust Text Parsing:** Correctly stops reading text before code blocks (` ``` `) or the next heading, ensuring clean prompts.
* **Configurable Storage:** Saves all generated images to a user-defined folder.

## 💡 Planned Features

* AI Horde integration
* Local Stable Diffusion (AUTOMATIC1111) API integration

## 🔧 Manual Installation

Since this plugin is not on the community store, you must install it manually.

1.  Navigate to your Obsidian vault's plugin folder: `YourVault/.obsidian/plugins/`.
2.  Create a new folder named `note-illustrator`.
3.  Inside this new folder, create two files:
    * `main.js` (copy the code from this project)
    * `manifest.json` (copy the code from this project)
4.  Restart Obsidian.
5.  Go to **Settings > Community Plugins**.
6.  Turn off "Safe Mode" if it's on.
7.  Find "Note Illustrator" in your list of installed plugins and **enable it**.

## ⚙️ Configuration

After installing, you **must** configure the plugin:

1.  Go to **Settings** in Obsidian.
2.  Scroll down to the "Plugin Options" section and click on **"Note Illustrator"**.

![Note Illustrator Settings Panel](settings.png)

### Prompt Heading
These settings define where the plugin looks for the prompt text.

* **Heading Level:** The Markdown heading level (e.g., `#`, `##`, `###`).
    * **Default:** `#`
* **Heading Text:** The text of the heading (e.g., `Description`, `Appearance`).
    * **Default:** `Description`

### API & Image Settings

* **OpenAI API Key:** Your secret key from OpenAI. Required for DALL-E 3. (This is a paid service).
* **Placeholder Filenames:** A list of *all* filenames to be detected as placeholders. **Put each filename on a new line.** (Defaults to 5 rows high).
* **Generated Image Folder:** The folder where new images will be saved (it will be created automatically).
* **Image Size:** The DALL-E 3 size to use when "Smart Sizing" is **disabled**.
* **Smart Sizing:** (Default: OFF) If enabled, the plugin will read the placeholder's dimensions (e.g., `|600x600`) and apply them to the new image.
    * **WARNING:** This feature may cause conflicts with other plugins (like `dnd-ui-toolkit`) that also parse the `|` symbol in image links.
* **Delete on Regenerate:** (Default: OFF) If enabled, regenerating an image will move the old, replaced image file to the system trash.
* **Prompt Prefix (Optional):** Text that is automatically added *before* your description to define the style. (Defaults to 5 rows high).

## 💡 How to Use

1.  Create or open a note for your NPC, location, or character.
2.  Ensure the note has a heading that matches your settings.
    * (Using default settings, this would be: `# Description`)
3.  Write your description text (e.g., `Fritz is a mountain of muscle...`) directly under this heading.
4.  Ensure the note *also* contains one of your defined placeholder images (e.g., `![[NPC-Placeholder.jpg]]`).
5.  Open the Command Palette (`Ctrl+P` or `Cmd+P`).
6.  Search for and select the command: **"Generate Image from Description & Replace Placeholder"**.
7.  Wait a moment. The plugin will generate the image and automatically replace the placeholder link.

### Regenerating an Image

Simply run the **same command** again ("Generate Image...").
* The plugin will see that `NPC-Placeholder.jpg` is gone and will instead find the image it just created.
* A modal will pop up asking: **"Regenerate Image?"**
* Click **"Yes, Regenerate"** to get a new image, or "Cancel" to stop.