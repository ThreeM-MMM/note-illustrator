"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toCommonJS = (mod) =>
  __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.js
var main_exports = {};
__export(main_exports, {
  default: () => NoteIllustratorPlugin,
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// Default settings for the plugin
var DEFAULT_SETTINGS = {
  apiKey: "",
  apiEndpoint: "https://api.openai.com/v1/images/generations",
  modelName: "dall-e-3",
  placeholderList: "NPC-Placeholder.jpg\nPlayer-Placeholder.jpg",
  generatedImageFolder: "AI-Generated-Images",
  imageSize: "1024x1024",
  promptPrefix: "A detailed D&D fantasy art portrait of: ",
  headingLevel: "#",
  headingText: "Description",
  useSmartSizing: false,
  deleteOnRegenerate: false,
  ttrpgVaultCompatibility: false,
};

// Confirmation Modal Class
class ConfirmationModal extends import_obsidian.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Regenerate Image?" });
    contentEl.createEl("p", {
      text: "A generated image already exists in this note. Do you want to replace it with a new one?",
    });

    const buttonContainer = contentEl.createDiv("modal-button-container");

    buttonContainer
      .createEl("button", { text: "Yes, Regenerate", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.close();
        this.onSubmit(true);
      });

    buttonContainer
      .createEl("button", { text: "Cancel" })
      .addEventListener("click", () => {
        this.close();
        this.onSubmit(false);
      });
  }
  onClose() {
    this.contentEl.empty();
  }
}

var NoteIllustratorPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "generate-ai-image",
      name: "Generate Image from Description & Replace Placeholder",
      editorCallback: (editor, view) =>
        this.generateAndReplaceImage(editor, view),
    });
    this.addSettingTab(new NoteIllustratorSettingTab(this.app, this));
  }

  // Helper: Get image dimensions
  async getPlaceholderDimensions(file) {
    if (!file || !file.path) {
      return null;
    }
    const resourcePath = this.app.vault.getResourcePath(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.src = resourcePath;
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        console.error(
          "Note Illustrator: Could not load placeholder image to read dimensions.",
        );
        resolve(null);
      };
    });
  }

  // Helper: Choose best DALL-E format
  getBestDallEFormat(width, height) {
    const aspectRatio = width / height;
    const wideThreshold = 1.375;
    const tallThreshold = 0.785;
    if (aspectRatio > wideThreshold) {
      return "1792x1024";
    } else if (aspectRatio < tallThreshold) {
      return "1024x1792";
    } else {
      return "1024x1024";
    }
  }

  // Confirmation Modal Helper
  async showConfirmationModal() {
    return new Promise((resolve) => {
      new ConfirmationModal(this.app, (result) => {
        resolve(result);
      }).open();
    });
  }

  async generateAndReplaceImage(editor, view) {
    var _a, _b;
    if (
      (!this.settings.apiKey &&
        this.settings.apiEndpoint.includes("openai.com")) ||
      !this.settings.apiEndpoint
    ) {
      new import_obsidian.Notice(
        "API Key or Endpoint is missing. Please check plugin settings.",
      );
      return;
    }
    const file = view.file;
    if (!file) return;
    const content = await this.app.vault.read(file);

    const description = this.extractDescription(content);
    if (description == null || description.trim().length === 0) {
      new import_obsidian.Notice(
        `No text found under heading: '${this.settings.headingLevel} ${this.settings.headingText}'`,
      );
      return;
    }

    const placeholders = this.getPlaceholderList();
    if (placeholders.length === 0) {
      new import_obsidian.Notice(
        "No placeholder filenames defined in settings.",
      );
      return;
    }

    const placeholderRegex = this.createPlaceholderRegex(placeholders);
    let match = content.match(placeholderRegex);
    let isRegenerating = false;
    let oldImagePath = null;
    let targetRegex = placeholderRegex;

    if (!match) {
      // Priority 2: Find a previously generated image
      const folder = this.settings.generatedImageFolder.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const generatedRegex = new RegExp(
        `!\\[\\[(${folder}\\/[^|\\]]+\\.png)(\\|[^\\]]*)?\\]\\]`,
      );
      match = content.match(generatedRegex);

      if (match) {
        isRegenerating = true;
        targetRegex = generatedRegex;
        oldImagePath = match[1];
      }
    }

    if (!match) {
      new import_obsidian.Notice(
        "No placeholder or previously generated image found to replace.",
      );
      return;
    }

    if (isRegenerating) {
      const confirmed = await this.showConfirmationModal();
      if (!confirmed) {
        new import_obsidian.Notice("Regeneration cancelled.");
        return;
      }
    }

    const placeholderFilename = match[1];
    let embedSuffix = match[2] || "";
    let dallESize = this.settings.imageSize;

    if (this.settings.useSmartSizing) {
      const placeholderFile = this.app.metadataCache.getFirstLinkpathDest(
        placeholderFilename,
        file.path,
      );

      if (placeholderFile instanceof import_obsidian.TFile) {
        const dimensions = await this.getPlaceholderDimensions(placeholderFile);
        if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
          dallESize = this.getBestDallEFormat(
            dimensions.width,
            dimensions.height,
          );

          if (!isRegenerating) {
            embedSuffix = `|${dimensions.width}x${dimensions.height}`;
          }
          new import_obsidian.Notice(
            `Smart Sizing: Found ${dimensions.width}x${dimensions.height}. Requesting ${dallESize}.`,
          );
        } else {
          new import_obsidian.Notice(
            "Smart Sizing: Could not read placeholder dimensions. Using default format.",
          );
        }
      } else {
        new import_obsidian.Notice(
          "Smart Sizing: Placeholder file not found. Using default format.",
        );
      }
    }

    const prefix = this.settings.promptPrefix || "";
    const fullPrompt = prefix + description;

    if (fullPrompt.trim().length === 0) {
      new import_obsidian.Notice(
        "Generated prompt is empty. Check settings and description text.",
      );
      return;
    }

    new import_obsidian.Notice(
      `Generating ${dallESize} image with model ${this.settings.modelName}...`,
    );

    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: this.settings.apiEndpoint,
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.settings.modelName,
          prompt: fullPrompt,
          n: 1,
          size: dallESize,
          response_format: "b64_json",
        }),
        throw: false,
      });

      if (response.status !== 200) {
        let errorMessage = "Unknown API error.";
        let responseJson = response.json;
        if (responseJson && responseJson.error && responseJson.error.message) {
          errorMessage = responseJson.error.message;
        } else {
          errorMessage = `Status ${response.status}: ${response.text}`;
        }
        throw new Error(errorMessage);
      }

      const b64Json =
        (_b = (_a = response.json) == null ? void 0 : _a.data[0]) == null
          ? void 0
          : _b.b64_json;
      if (!b64Json) {
        throw new Error(
          "No image data (b64_json) found in API response. Response was: " +
            JSON.stringify(response.json),
        );
      }

      const imageBinary = (0, import_obsidian.base64ToArrayBuffer)(b64Json);
      const folder = this.settings.generatedImageFolder;
      await this.ensureFolderExists(folder);

      const fileName = `${file.basename}-${Date.now()}.png`;
      const filePath = (0, import_obsidian.normalizePath)(
        `${folder}/${fileName}`,
      );
      await this.app.vault.createBinary(filePath, imageBinary);

      const newImageLink = `![[${filePath}${embedSuffix}]]`;

      const newContent = content.replace(targetRegex, newImageLink);
      await this.app.vault.modify(file, newContent);

      // *** UPDATE FRONTMATTER ***
      if (this.settings.ttrpgVaultCompatibility) {
        let keyUpdated = false;
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          // *** CHANGE HERE: Use fileName instead of filePath ***
          if (fm["Image"]) {
            fm["Image"] = fileName;
            keyUpdated = true;
          } else if (fm["image"]) {
            fm["image"] = fileName;
            keyUpdated = true;
          }
        });
        if (keyUpdated) {
          new import_obsidian.Notice("Frontmatter 'Image:' key updated.");
        }
      }
      // *** END OF BLOCK ***

      new import_obsidian.Notice(
        "Image successfully generated and placeholder replaced!",
      );

      if (isRegenerating && this.settings.deleteOnRegenerate && oldImagePath) {
        const oldFile = this.app.vault.getAbstractFileByPath(oldImagePath);
        if (oldFile instanceof import_obsidian.TFile) {
          await this.app.vault.trash(oldFile, true);
          new import_obsidian.Notice(
            `Old image ${oldFile.basename} moved to trash.`,
          );
        }
      }
    } catch (error) {
      console.error("Note Illustrator Error:", error.message);
      new import_obsidian.Notice(
        `Note Illustrator Error: ${error.message}`,
        15e3,
      );
    }
  }

  extractDescription(content) {
    const level = this.settings.headingLevel;
    const text = this.settings.headingText;
    if (!level || !text) return null;

    const escapedLevel = level.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(
      `^${escapedLevel}\\s+${escapedText}\\s*([\\s\\S]*?)(?=^#+ .|\\s*\\\`\`\`|\\s*$)`,
      "m",
    );

    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  getPlaceholderList() {
    return this.settings.placeholderList
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  createPlaceholderRegex(placeholders) {
    const escapedPlaceholders = placeholders.map((p) =>
      p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp(
      `!\\[\\[(${escapedPlaceholders.join("|")})(\\|[^\\]]*)?\\]\\]`,
    );
  }

  async ensureFolderExists(folderPath) {
    try {
      await this.app.vault.createFolder(folderPath);
    } catch (e) {
      if (e.message !== "Folder already exists.") {
        throw e;
      }
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

// Settings Tab
var NoteIllustratorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Illustrator - Settings" });

    containerEl.createEl("p", {
      text: "Defines the heading to use as the image prompt.",
    });

    new import_obsidian.Setting(containerEl)
      .setName("Heading Level")
      .setDesc("The Markdown heading level to search for (e.g., #, ##, ###).")
      .addText((text) =>
        text
          .setPlaceholder("#")
          .setValue(this.plugin.settings.headingLevel)
          .onChange(async (value) => {
            this.plugin.settings.headingLevel = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Heading Text")
      .setDesc("The text of the heading to search for (e.g., 'Description').")
      .addText((text) =>
        text
          .setPlaceholder("Description")
          .setValue(this.plugin.settings.headingText)
          .onChange(async (value) => {
            this.plugin.settings.headingText = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("hr");
    containerEl.createEl("p", {
      text: "Configures the API and image details.",
    });

    new import_obsidian.Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Your API key from OpenAI (or compatible service).")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("API Endpoint URL")
      .setDesc("The URL for the image generation API (OpenAI-compatible).")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1/images/generations")
          .setValue(this.plugin.settings.apiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.apiEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Model Name")
      .setDesc("The model name to request from the API.")
      .addText((text) =>
        text
          .setPlaceholder("dall-e-3")
          .setValue(this.plugin.settings.modelName)
          .onChange(async (value) => {
            this.plugin.settings.modelName = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Placeholder Filenames")
      .setDesc(
        "A list of all filenames that should be detected as placeholders (one file per line).",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("NPC-Placeholder.jpg\nPlayer-Placeholder.jpg")
          .setValue(this.plugin.settings.placeholderList)
          .onChange(async (value) => {
            this.plugin.settings.placeholderList = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.cols = 34;
      });

    new import_obsidian.Setting(containerEl)
      .setName("Generated Image Folder")
      .setDesc(
        "The name of the folder where new images will be saved (will be created automatically).",
      )
      .addText((text) =>
        text
          .setPlaceholder("AI-Generated-Images")
          .setValue(this.plugin.settings.generatedImageFolder)
          .onChange(async (value) => {
            this.plugin.settings.generatedImageFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Image Size (DALL-E 3)")
      .setDesc(
        "The DALL-E 3 size to use when 'Smart Sizing' is disabled. Ignored by other models.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("1024x1024", "1024x1024 (Square)")
          .addOption("1792x1024", "1792x1024 (Widescreen)")
          .addOption("1024x1792", "1024x1792 (Portrait)")
          .setValue(this.plugin.settings.imageSize)
          .onChange(async (value) => {
            this.plugin.settings.imageSize = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Smart Sizing")
      .setDesc(
        "If enabled, the plugin will embed the new image using the original placeholder's dimensions (e.g., |600x600). WARNING: This may cause conflicts with other plugins (like dnd-ui-toolkit) that parse the '|' symbol.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useSmartSizing)
          .onChange(async (value) => {
            this.plugin.settings.useSmartSizing = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Delete on Regenerate")
      .setDesc(
        "If enabled, regenerating an image will move the old image file to the system trash.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deleteOnRegenerate)
          .onChange(async (value) => {
            this.plugin.settings.deleteOnRegenerate = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Obsidian TTRPG Community Vault compatibility")
      .setDesc(
        "If enabled, the plugin will also update the 'Image:' (or 'image:') key in the note's frontmatter to the new filename.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ttrpgVaultCompatibility)
          .onChange(async (value) => {
            this.plugin.settings.ttrpgVaultCompatibility = value;
            await this.plugin.saveSettings();
          }),
      );

    new import_obsidian.Setting(containerEl)
      .setName("Prompt Prefix (Optional)")
      .setDesc(
        "Text that is automatically added before your description to define the style.",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("A detailed D&D fantasy art portrait of: ")
          .setValue(this.plugin.settings.promptPrefix)
          .onChange(async (value) => {
            this.plugin.settings.promptPrefix = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.cols = 34;
      });
  }
};
