import { Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type PaperImporterPluginSettings,
	PaperImporterSettingTab,
} from "./setting_tab";
import { ImportModal } from "./import_modal.svelte";

export default class PaperImporterPlugin extends Plugin {
	settings: PaperImporterPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "import_pdf_from_arxiv",
			name: "Import PDF from arXiv",
			callback: () => {
				new ImportModal(this.app, this.settings).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PaperImporterSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
