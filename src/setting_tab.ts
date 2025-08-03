import { PluginSettingTab, App, Setting } from "obsidian";
import PaperImporterPlugin from "./main";

export class PaperImporterSettingTab extends PluginSettingTab {
	plugin: PaperImporterPlugin;

	constructor(app: App, plugin: PaperImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("PDF folder")
			.setDesc("Folder to save imported PDFs")
			.addText((text) =>
				text
					.setPlaceholder("Example: Assets")
					.setValue(this.plugin.settings.pdfFolder)
					.onChange(async (value) => {
						this.plugin.settings.pdfFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Note folder")
			.setDesc("Folder to save auto-generated notes for imported PDFs")
			.addText((text) =>
				text
					.setPlaceholder("Example: Notes")
					.setValue(this.plugin.settings.noteFolder)
					.onChange(async (value) => {
						this.plugin.settings.noteFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
// Remember to rename these classes and interfaces!
export interface PaperImporterPluginSettings {
	pdfFolder: string;
	noteFolder: string;
}
export const DEFAULT_SETTINGS: PaperImporterPluginSettings = {
	pdfFolder: "Assets",
	noteFolder: "Literature Notes",
};
