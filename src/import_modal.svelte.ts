import { App, Modal, Notice, normalizePath } from "obsidian";
import { mount, unmount } from "svelte";

import ImportDialog from "./component/ImportDialog.svelte";

import { searchPaper } from "./arxiv";
import noteTemplate from "./note_template";
import type { PaperImporterPluginSettings } from "./setting_tab";

export class ImportModal extends Modal {
	settings: PaperImporterPluginSettings;
	importDialog: ReturnType<typeof ImportDialog> | null = null;
	states: Record<string, any> = $state({
		logs: [],
		downloadProgress: 0,
	});

	constructor(app: App, settings: PaperImporterPluginSettings) {
		super(app);
		this.settings = settings;
	}

	onOpen() {
		let { contentEl } = this;

		this.importDialog = mount(ImportDialog, {
			target: contentEl,
			props: {
				states: this.states,
				onkeypress: async (e: KeyboardEvent, paperUri: string) => {
					if (e.key === "Enter") {
						// Reset progress and messages
						this.states.downloadProgress = 0;
						this.states.logs.length = 0;
						this.states.logs.push(["info", "Importing paper..."]);

						let arxivId: string;
						try {
							arxivId = this.extractArxivId(paperUri);
						} catch (error) {
							this.states.downloadProgress = 0;
							new Notice(error.message);
							return;
						}

						try {
							const [notePath, _] =
								await this.searchAndImportPaper(arxivId);
							await this.app.workspace.openLinkText(
								notePath,
								"",
								true
							);
						} catch (error) {
							this.states.downloadProgress = 0;
							return;
						}

						this.states.logs.push([
							"success",
							"Paper imported successfully!",
						]);
						new Notice("Paper imported successfully!");

						this.close();
					}
				},
			},
		});
	}

	onClose() {
		if (this.importDialog) {
			unmount(this.importDialog);
		}
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

		// Check if PDF already exists
		const pdfExists = await this.app.vault.adapter.exists(pdfPath);
		if (pdfExists) {
			this.states.logs.push(["error", `PDF already exists: ${pdfPath}`]);
			throw new Error(`PDF already exists: ${pdfPath}`);
		}

		// Download PDF with progress tracking
		this.states.downloadProgress = 0;
		this.states.logs.push(["info", "Starting PDF download..."]);

		try {
			const response = await fetch(paper.pdfUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to download PDF: ${response.statusText}`
				);
			}

			const contentLength = response.headers.get("content-length");
			const total = contentLength ? parseInt(contentLength, 10) : 0;

			if (!response.body) {
				throw new Error("Response body is empty");
			}

			const reader = response.body.getReader();
			const chunks: Uint8Array[] = [];
			let received = 0;

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				chunks.push(value);
				received += value.length;

				if (total > 0) {
					this.states.downloadProgress = (received / total) * 100;
				} else {
					// If we don't know the total size, show indeterminate progress
					this.states.downloadProgress = Math.min(
						50 + (received / 1000000) * 10,
						90
					);
				}
			}

			// Combine all chunks into a single array buffer
			const arrayBuffer = new Uint8Array(received);
			let position = 0;
			for (const chunk of chunks) {
				arrayBuffer.set(chunk, position);
				position += chunk.length;
			}

			await this.app.vault.adapter.writeBinary(
				pdfPath,
				arrayBuffer.buffer
			);
			this.states.downloadProgress = 100;
		} catch (error) {
			this.states.downloadProgress = 0;
			this.states.logs.push([
				"error",
				`PDF download failed: ${error.message}`,
			]);
			throw error;
		}

		this.states.logs.push(["info", `PDF downloaded: ${pdfPath}`]);

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

		// Check if note already exists
		const noteExists = await this.app.vault.adapter.exists(notePath);
		if (noteExists) {
			this.states.logs.push([
				"error",
				`Note already exists: ${notePath}`,
			]);
			throw new Error(`Note already exists: ${notePath}`);
		}

		const noteContent = noteTemplate
			.replace(/{{\s*paper_id\s*}}/g, paper.paperId)
			.replace(/{{\s*title\s*}}/g, `"${paper.title}"`)
			.replace(/{{\s*authors\s*}}/g, paper.authors.join(", "))
			.replace(/{{\s*date\s*}}/g, paper.date)
			.replace(/{{\s*abstract\s*}}/g, `"${paper.abstract}"`)
			.replace(/{{\s*comments\s*}}/g, `"${paper.comments}"`)
			.replace(/{{\s*pdf_link\s*}}/g, `"[[${pdfPath}]]"`);
		await this.app.vault.adapter.write(notePath, noteContent);

		this.states.logs.push(["info", `Note created: ${notePath}`]);

		return [notePath, pdfPath];
	}

	extractArxivId(text: string): string {
		// Match against arXiv:xxxx.xxxx or arxiv:xxxx.xxxxx
		const arxivIdPattern = /^ar[Xx]iv:(\d{4}\.\d{4,5}(?:v\d+)?)$/;
		const match = text.match(arxivIdPattern);
		if (match) {
			return match[match.length - 1];
		}

		// Match against arXiv:xxxxx/xxxxxxx or arxiv:xxxxx/xxxxxxx
		const arxivIdPattern2 = /^ar[Xx]iv:(.+\/\d+(?:v\d+)?)$/;
		const match2 = text.match(arxivIdPattern2);
		if (match2) {
			return match2[match2.length - 1];
		}

		// Match against arxiv.org/abs/xxxx.xxxx or
		// arxiv.org/abs/xxxx.xxxxx or
		// arxiv.org/pdf/xxxx.xxxx or
		// arxiv.org/pdf/xxxx.xxxxx or
		// arxiv.org/html/xxxx.xxxx or
		// arxiv.org/html/xxxx.xxxxx
		const urlPattern =
			/^(https?:\/\/)?(www\.)?arxiv\.org\/(abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?)$/;
		const urlMatch = text.match(urlPattern);
		if (urlMatch) {
			return urlMatch[urlMatch.length - 1];
		}

		// Match against arxiv.org/abs/xxxxx/xxxxxxx or
		// arxiv.org/pdf/xxxxx/xxxxxxx or
		// arxiv.org/html/xxxxx/xxxxxx or
		const urlPattern2 =
			/^(https?:\/\/)?(www\.)?arxiv\.org\/(abs|pdf|html)\/(.+\/\d+(?:v\d+)?)$/;
		const urlMatch2 = text.match(urlPattern2);
		if (urlMatch2) {
			return urlMatch2[urlMatch2.length - 1];
		}

		// Match against xxxx.xxxx or xxxx.xxxxx
		const idPattern = /^(\d{4}\.\d{4,5}(?:v\d+)?)$/;
		const idMatch = text.match(idPattern);
		if (idMatch) {
			return idMatch[idMatch.length - 1];
		}

		// Match against xxxxx/xxxxxxx
		const idPattern2 = /^(\d+\/\d+(?:v\d+)?)$/;
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
