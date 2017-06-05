define(function(require, exports, module) {

	'use strict';

	// Brackets modules
	var DocumentManager = brackets.getModule("document/DocumentManager"),
		EditorManager = brackets.getModule("editor/EditorManager"),
		KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
		CommandManager = brackets.getModule("command/CommandManager"),
		KeyEvent = brackets.getModule("utils/KeyEvent"),
		AppInit = brackets.getModule("utils/AppInit"),
		ProjectManager = brackets.getModule("project/ProjectManager"),
		FileSystem = brackets.getModule("filesystem/FileSystem"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils");

	//var modalHTML = require("text!modal.html");

	var DRAG_AND_MOVE = require("drag_and_move");

	var commandID_modal = "jzmstrjp.drop_includer.drop_includer_open",
		commandID_browse_root_path = "jzmstrjp.drop_includer.drop_includer_browse_root_path",
		commandID_browse_relative_path = "jzmstrjp.drop_includer.drop_includer_browse_relative_path";

	var currentDoc,
		editor;

	var dropZone;




	ExtensionUtils.loadStyleSheet(module, "main.less");

	CommandManager.register("Open Drop Includer", commandID_modal, openDialog);
	KeyBindingManager.addBinding(commandID_modal, "Ctrl-.");

	CommandManager.register("Drop Includer(Browse: Root Path)", commandID_browse_root_path, function(){
		openBrowse({root: true});
	});
	KeyBindingManager.addBinding(commandID_browse_root_path, "Ctrl-Shift-.");

	CommandManager.register("Drop Includer(Browse: Relative Path)", commandID_browse_relative_path, openBrowse);
	KeyBindingManager.addBinding(commandID_browse_relative_path, "Ctrl-Shift-Alt-.");


	function openBrowse(obj) {
		var root = false;
		var addTitle = "(Relative Path)";
		if(obj && obj.root === true){
			root = true;
			addTitle = "(Root Path)";
		}


		currentDoc = DocumentManager.getCurrentDocument();
		if (!currentDoc) {return false};

		editor = EditorManager.getCurrentFullEditor();
		if (!editor) {return false};

		var docPath = currentDoc.file._parentPath;

		FileSystem.showOpenDialog(true, false, "Select File(s) to include. " + addTitle, null, null, function(str, paths) {
			paths.forEach(function(elm) {
				var relativeFilename = abspath2rel(docPath, elm, root);
				relativeFilename = tagMaker(relativeFilename, root, editor);
				doInsert({ text: relativeFilename });
				if (paths.length > 1) {
					editor.getSelections().forEach(function(elme, i, array) {
						editor.document.replaceRange("\n", editor.getSelections()[i]["start"]);
					});
				}
			});
		});
	}


	/*****************************
	 * init
	 */
	function init() {
		initDropDialog();
	}


	/*****************************
	 * drop dialog initialize
	 */
	function initDropDialog() {
		dropZone = document.createElement("div");
		dropZone.id = "tagInserterDropZone";
		document.body.appendChild(dropZone);
		dropZone.innerHTML = '<div class="tagInserterWaku" id="tagInserterRoot"><p class="tagInserterP">Root Path</p></div><p id="tagInserterClose"><span>Close</span></p><div class="tagInserterWaku" id="tagInserterRel"><p class="tagInserterP">Relative Path</p></div><p class="tagInserterCenterP"><span>Drop the files.</span></p>';
		var $dropZoneChild = $("#tagInserterDropZone .tagInserterWaku");
		$dropZoneChild.on('dragenter', _handleDragEnter);
		$dropZoneChild.on('dragleave', _handleDragLeave);
		$dropZoneChild.on('drop', _handleDrop);
		document.getElementById("tagInserterClose").addEventListener("click", function() {
			dropZone.style.display = "none";
		});

		DRAG_AND_MOVE.drag_and_move(dropZone, { dragZone: ".tagInserterCenterP", resizer: true });
	}

	function openDialog() {
		if (dropZone && dropZone.style.display !== "block") {
			dropZone.style.display = "block";
		} else {
			dropZone.style.display = "none";
		}
	}


	/******************************
	 * drag and drop handle
	 */
	function _handleDrop(e) {
		var root = false;
		if (this.id === "tagInserterRoot") {
			root = true;
		}

		currentDoc = DocumentManager.getCurrentDocument();
		if (!currentDoc) {return false};

		editor = EditorManager.getCurrentFullEditor();
		if (!editor) {return false};


		var files = e.originalEvent.dataTransfer.files,
			docPath = currentDoc.file._parentPath;

		if (files && files.length) {
			e.stopPropagation();
			e.preventDefault();

			brackets.app.getDroppedFiles(function(err, paths) {
				//console.log(paths);
				if (!err) {
					paths.forEach(function(elm) {
						var relativeFilename = abspath2rel(docPath, elm, root);
						relativeFilename = tagMaker(relativeFilename, root, editor);
						doInsert({ text: relativeFilename });
						if (files.length > 1) {
							editor.getSelections().forEach(function(elme, i, array) {
								editor.document.replaceRange("\n", editor.getSelections()[i]["start"]);
							});
						}
					});
				}
			});
		}
	}

	function getMode(editor) {
		var mode = editor.getModeForSelection();
		return mode;
	}

	function tagMaker(path, root, editor) {
		var mode = getMode(editor);
		var phpStart = '<?php ';
		var phpEnd = '?>';
		if (mode === "clike") {
			phpStart = '';
			phpEnd = '';
		}
		var rtn;
		var pathArr = path.split(".");
		var ex = pathArr[pathArr.length - 1];
		var noEx = path.replace(new RegExp("." + ex + "$"), "");
		switch (ex) {
			case "jpg":
			case "jpeg":
			case "png":
			case "gif":
			case "svg":
				switch (mode) {
					case "text/x-less":
					case "text/x-scss":
					case "css":
						rtn = 'background-image: url(' + path + ');';
						break;
					default:
						rtn = '<img src="' + path + '" alt="xxxxx">';
				}
				break;
			case "css":
			case "scss":
			case "less":
				switch (mode) {
					case "text/x-" + ex:
						rtn = '@import "' + path + '";';
						break;
					case "text/x-scss":
					case "text/x-less":
					case "css":
						rtn = '@import "' + noEx + '.css";';
						break;
					default:
						rtn = '<link rel="stylesheet" href="' + noEx + '.css">';
				}
				break;
			case "js":
				rtn = '<script src="' + path + '"></script>';
				break;
			case "mp3":
			case "wav":
				rtn = '<audio src="' + path + '"></audio>';
				break;
			case "mp4":
				rtn = '<video src="' + path + '"></video>';
				break;
			case "html":
			case "php":
				if (root) {
					rtn = phpStart + 'include $_SERVER["DOCUMENT_ROOT"]."' + path + '";' + phpEnd;
				} else {
					rtn = phpStart + 'include dirname(__FILE__)."/' + path + '";' + phpEnd;
				}
				break;
			default:
				rtn = path;
		}
		return rtn;
	}

	function _handleDragEnter(e) {
		e.stopPropagation();
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	}

	function _handleDragLeave(e) {
		e.stopPropagation();
		e.preventDefault();
	}


	function abspath2rel(base_path, target_path, root) {
		if (root) {
			var projectRootPath = ProjectManager.getInitialProjectPath();
			var rootPathFileName = "/" + target_path.replace(projectRootPath, "");
			return rootPathFileName;
		}

		var tmp_str = '';
		base_path = base_path.split('/');
		base_path.pop();
		target_path = target_path.split('/');
		while (base_path[0] === target_path[0]) {
			base_path.shift();
			target_path.shift();
		}
		for (var i = 0; i < base_path.length; i++) {
			tmp_str += '../';
		}
		return tmp_str + target_path.join('/');
	}



	/*****************************
	 * insert
	 */
	function doInsert(insertItem) {
		var selections = editor.getSelections(),
			edits = [];

		selections.forEach(function(sel) {
			queueEdits(edits, getEdits(sel, insertItem));
		});

		// batch for single undo
		currentDoc.batchOperation(function() {
			// perform edits
			selections = editor.document.doMultipleEdits(edits);
			editor.setSelections(selections);

			// indent lines with selections
			selections.forEach(function(sel) {
				if (!sel.end || sel.start.line === sel.end.line) {
					// The document is the one that batches operations, but we want to use
					// CodeMirror's indent operation. So we need to use the document's own
					// backing editor's CodeMirror to do the indentation.
					currentDoc._masterEditor._codeMirror.indentLine(sel.start.line);
				}
			});
		});
	}

	function getEdits(sel, insertItem) {
		var newTagPair = insertItem.text.split("|");

		var selText = currentDoc.getRange(sel.start, sel.end),
			openTag = newTagPair[0],
			closeTag = newTagPair.length === 2 ? newTagPair[1] : "",
			insertString = openTag + selText + closeTag,
			replSelEnd = $.extend({}, sel.end);

		// reset selection
		var selNewStart = $.extend({}, sel.start),
			selNewEnd = $.extend({}, sel.end);

		selNewStart.ch += openTag.length;
		if (sel.start.line === sel.end.line) {
			selNewEnd.ch += openTag.length;
		}

		return {
			edit: { text: insertString, start: sel.start, end: replSelEnd },
			selection: { start: selNewStart, end: selNewEnd, primary: sel.primary, isBeforeEdit: false }
		};
	}

	function queueEdits(edits, val) {
		if (val) {
			if (Array.isArray(val)) {
				val.forEach(function(v) {
					edits.push(v);
				});
			} else {
				edits.push(val);
			}
		}
	}

	// Initialize extension
	AppInit.appReady(function() {
		init();
	});



});
