import { App, Modal, Notice, normalizePath, requestUrl } from "obsidian";

import { searchPaper } from "./arxiv";
import noteTemplate from "./note_template";
import { PaperImporterPluginSettings } from "./setting_tab";

export class ImportModal extends Modal {
	settings: PaperImporterPluginSettings;

	constructor(app: App, settings: PaperImporterPluginSettings) {
		super(app);

		this.settings = settings;
	}

	onOpen() {
		let { contentEl } = this;

		contentEl.createEl("h4", {
			text: "Import Paper from arXiv",
		});
		contentEl.createEl("p", {
			text: "Enter the arXiv ID or URL of the paper you want to import. Press Enter to confirm.",
			attr: { style: "margin-bottom: 20px; color: gray" },
		});
		contentEl.createEl("input", {
			attr: {
				type: "text",
				style: "width: 100%;",
				id: "paper-title-input",
			},
		});

		contentEl.addEventListener("keypress", async (e) => {
			if (e.key === "Enter") {
				new Notice("Importing paper...");

				const paper = (
					contentEl.querySelector(
						"#paper-title-input"
					) as HTMLInputElement
				).value;

				let arxivId: string;
				try {
					arxivId = this.extractArxivId(paper);
				} catch (error) {
					new Notice(error.message);
					return;
				}

				try {
					const [notePath, _] = await this.searchAndImportPaper(
						arxivId
					);
					await this.app.workspace.openLinkText(notePath, "", true);
				} catch (error) {
					new Notice(error.message);
				}

				new Notice("Paper imported!");

				this.close();
			}
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}

	async searchAndImportPaper(arxivId: string): Promise<[string, string]> {
		const paper = await searchPaper(arxivId);

		const pdfFolder = normalizePath(this.settings.pdfFolder);

		let pdfFolderPath = this.app.vault.getFolderByPath(pdfFolder)!;
		if (!pdfFolderPath) {
			pdfFolderPath = await this.app.vault.createFolder(pdfFolder);
		}

		const pdfFilename = this.sanitizeFilename(
			`${paper.title} (${paper.paperId}).pdf`
		);
		const pdfPath = normalizePath(`${pdfFolderPath.path}/${pdfFilename}`);

		const response = await requestUrl(paper.pdfUrl);
		await this.app.vault.adapter.writeBinary(pdfPath, response.arrayBuffer);

		const noteFolder = normalizePath(this.settings.noteFolder);

		let noteFolderPath = this.app.vault.getFolderByPath(noteFolder)!;
		if (!noteFolderPath) {
			noteFolderPath = await this.app.vault.createFolder(noteFolder);
		}

		const noteFilename = this.sanitizeFilename(
			`${paper.title} (${paper.paperId}).md`
		);
		const notePath = normalizePath(
			`${noteFolderPath.path}/${noteFilename}`
		);
		const noteContent = noteTemplate
			.replace(/{{\s*paper_id\s*}}/g, paper.paperId)
			.replace(/{{\s*title\s*}}/g, `"${paper.title}"`)
			.replace(/{{\s*authors\s*}}/g, paper.authors.join(", "))
			.replace(/{{\s*date\s*}}/g, paper.date)
			.replace(/{{\s*abstract\s*}}/g, `"${paper.abstract}"`)
			.replace(/{{\s*comments\s*}}/g, `"${paper.comments}"`)
			.replace(/{{\s*pdf_link\s*}}/g, `"[[${pdfPath}]]"`);

		await this.app.vault.adapter.write(notePath, noteContent);

		return [notePath, pdfPath];
	}

	extractArxivId(text: string): string {
		// Match against arXiv:xxxx.xxxx or arxiv:xxxx.xxxxx
		const arxivIdPattern = /^ar[Xx]iv:(\d{4}\.\d{4,5})(?:v\d+)?$/;
		const match = text.match(arxivIdPattern);
		if (match) {
			return match[match.length - 1];
		}

		// Match against arXiv:xxxxx/xxxxxxx or arxiv:xxxxx/xxxxxxx
		const arxivIdPattern2 = /^ar[Xx]iv:(.+\/\d+)(?:v\d+)?$/;
		const match2 = text.match(arxivIdPattern2);
		if (match2) {
			return match2[match2.length - 1];
		}

		// Match against arxiv.org/abs/xxxx.xxxx or arxiv.org/abs/xxxx.xxxxx or
		// arxiv.org/pdf/xxxx.xxxx or arxiv.org/pdf/xxxx.xxxxx
		const urlPattern =
			/^(https?:\/\/)?(www\.)?arxiv\.org\/(abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?$/;
		const urlMatch = text.match(urlPattern);
		if (urlMatch) {
			return urlMatch[urlMatch.length - 1];
		}

		// Match against arxiv.org/abs/xxxxx/xxxxxxx or arxiv.org/abs/xxxxx/xxxxxxx or
		// arxiv.org/pdf/xxxxx/xxxxxxx or arxiv.org/pdf/xxxxx/xxxxxxx
		const urlPattern2 =
			/^(https?:\/\/)?(www\.)?arxiv\.org\/(abs|pdf)\/(.+\/\d+)(?:v\d+)?$/;
		const urlMatch2 = text.match(urlPattern2);
		if (urlMatch2) {
			return urlMatch2[urlMatch2.length - 1];
		}

		// Match against xxxx.xxxx or xxxx.xxxxx
		const idPattern = /^(\d{4}\.\d{4,5})(?:v\d+)?$/;
		const idMatch = text.match(idPattern);
		if (idMatch) {
			return idMatch[idMatch.length - 1];
		}

		// Match against xxxxx/xxxxxxx
		const idPattern2 = /^(\d+\/\d+)(?:v\d+)?$/;
		const idMatch2 = text.match(idPattern2);
		if (idMatch2) {
			return idMatch2[idMatch2.length - 1];
		}

		throw new Error("Invalid arXiv ID or URL");
	}

	sanitizeFilename(filename: string): string {
		return filename
			.replace(/[/\\?%*:|"<>]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}
}
