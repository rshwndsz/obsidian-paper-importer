import { Plugin } from "obsidian";
import { ImportModal } from "./import_modal.svelte";
import {
	DEFAULT_SETTINGS,
	type PaperImporterPluginSettings,
	PaperImporterSettingTab,
} from "./setting_tab";

export default class PaperImporterPlugin extends Plugin {
	settings: PaperImporterPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a command to import metadata and download PDF from arXiv
		this.addCommand({
			id: "import_pdf_from_arxiv",
			name: "Import metadata and PDF from arXiv",
			callback: () => {
				new ImportModal(this.app, this.settings, true).open();
			},
		});

		// This adds a command to import only metadata without downloading PDF
		this.addCommand({
			id: "import_metadata_from_arxiv",
			name: "Import metadata only from arXiv",
			callback: () => {
				new ImportModal(this.app, this.settings, false).open();
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
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
