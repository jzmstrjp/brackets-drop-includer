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
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils");

	var modalHTML = require("text!modal.html");

	var commandID = "jzmstrjp.drop_includer.drop_includer_open";

	var currentDoc,
		editor;

	var dropZone;


	ExtensionUtils.loadStyleSheet(module, "main.less");

	CommandManager.register("Open Drop Includer", commandID, openDialog);
	KeyBindingManager.addBinding(commandID, "Ctrl-.");



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
		dropZone.innerHTML = modalHTML;
		var $dropZoneChild = $("#tagInserterDropZone .tagInserterWaku");
		$dropZoneChild.on('dragenter', _handleDragEnter);
		$dropZoneChild.on('dragleave', _handleDragLeave);
		$dropZoneChild.on('drop', _handleDrop);
		document.getElementById("tagInserterClose").addEventListener("click", function(){
			dropZone.style.display = "none";
		});
	}

	function openDialog(){
		if(dropZone && dropZone.style.display !== "block"){
			dropZone.style.display = "block";
		}else{
			dropZone.style.display = "none";
		}
	}


	/******************************
	 * drag and drop handle
	 */
	function _handleDrop(e) {
		var root = false;
		if(this.id === "tagInserterRoot"){
			root = true;
		}

		currentDoc = DocumentManager.getCurrentDocument();
		if (!currentDoc) return false;

		editor = EditorManager.getCurrentFullEditor();
		if (!editor) return false;


		var files = e.originalEvent.dataTransfer.files,
			docPath = currentDoc.file._parentPath;


		if (files && files.length) {
			e.stopPropagation();
			e.preventDefault();

			brackets.app.getDroppedFiles(function(err, paths) {
				if (!err) {
					paths.forEach(function(elm) {
						var relativeFilename = abspath2rel(docPath, elm, root);
						relativeFilename = tagMaker(relativeFilename, root);
						doInsert({ text: relativeFilename });
						if(files.length > 1){
							editor.getSelections().forEach(function(elme, i, array){
								editor.document.replaceRange("\n", editor.getSelections()[i]["start"]);
							});
						}
					});
				}
			});

		}

		//dropZone.style.display = "none";
	}

	function tagMaker(path, root) {
		var rtn;
		var pathArr = path.split(".");
		var ex = pathArr[pathArr.length - 1];
		switch(ex) {
			case "jpg":
			case "jpeg":
			case "png":
			case "gif":
			case "svg":
				rtn = '<img src="' + path + '" alt="xxxxx">';
				break;
			case "css":
				rtn = '<link rel="stylesheet" href="' + path + '">';
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

			case "php":
				if(root){
					rtn = '<?php include $_SERVER["DOCUMENT_ROOT"]."' + path + '";?>';
				} else {
					rtn = '<?php include dirname(__FILE__)."/' + path + '";?>';
				}
				break;
			default:
				rtn = path;
		}
		return rtn;
	}

	function _handleDragEnter(e) {
		//console.log("_handleDragEnter");
		e.stopPropagation();
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	}

	function _handleDragLeave(e) {
		//console.log("_handleDragLeave");
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
