/**
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 *@NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TaxCode_InvIdent_CLNT_V2.0.js		        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Aug 20 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/search', 'N/runtime', 'N/ui/message',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
        './Latam_Library/LMRY_Log_LBRY_V2.0'
    ],

    function(log, search, runtime, message, Library_Mail, Library_Log) {

        LMRY_SCRIPT = 'LMRY Tax Code by Invoicing Identifier V2.0';
        LMRY_SCRIPT_NAME = 'LMRY_TaxCode_InvIdent_CLNT_V2.0.js';

        var actionType = "";

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

            try {

                var recordObj = scriptContext.currentRecord;
                actionType = scriptContext.mode;

                var nameField = recordObj.getField({ fieldId: 'name' });
                nameField.isDisabled = true;

            } catch (error) {
                Library_Mail.sendemail('[ pageInit ]: ' + error, LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ pageInit ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
            }

        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {

        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {

            try {

                var recordObj = scriptContext.currentRecord;

                var invoicingID = recordObj.getText({ fieldId: 'custrecord_lmry_ste_invoicing_id' });
                var taxType = recordObj.getText({ fieldId: 'custrecord_lmty_ste_tax_type' });
                var taxCode = recordObj.getText({ fieldId: 'custrecord_lmry_ste_tax_code' });

                if ((invoicingID != null && invoicingID != '') && (taxType != null && taxType != '') && (taxCode != null && taxCode != '')) {

                    var setupName = taxType + ':' + taxCode + ' (' + invoicingID + ')';
                    recordObj.setValue({ fieldId: 'name', value: setupName, ignoreFieldChange: true });

                }

                return true;

            } catch (error) {
                Library_Mail.sendemail('[ validateField ]: ' + error, LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ validateField ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
            }

        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

        }

        /**
         * Validation function to be executed when record is deleted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateDelete(scriptContext) {

        }

        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {

            try {

                var recordObj = scriptContext.currentRecord;

                var language = runtime.getCurrentScript().getParameter({ name: 'LANGUAGE' });
                language = language.substring(0, 2).toUpperCase();

                var STE_Country = recordObj.getValue({ fieldId: 'custrecord_lmry_ste_country' });
                var STE_InvoicingID = recordObj.getValue({ fieldId: 'custrecord_lmry_ste_invoicing_id' });
                var STE_TaxType = recordObj.getValue({ fieldId: 'custrecord_lmty_ste_tax_type' });
                var STE_TaxCode = recordObj.getValue({ fieldId: 'custrecord_lmry_ste_tax_code' });

                var array_filters = [
                    ['custrecord_lmry_ste_country', 'anyof', STE_Country ],
                    'AND', ['custrecord_lmry_ste_invoicing_id', 'anyof', STE_InvoicingID],
                    'AND', ['custrecord_lmty_ste_tax_type', 'anyof', STE_TaxType],
                    'AND', ['custrecord_lmry_ste_tax_code', 'anyof', STE_TaxCode]
                ]
                if (actionType == 'edit') {
                    array_filters.push('AND', ['internalid', 'noneof', recordObj.id]);
                }

                var TaxCodeByInvIdent_Search = search.create({
                    type: 'customrecord_lmry_ste_tc_by_inv_ident',
                    columns: ['internalid'],
                    filters: array_filters
                }).run().getRange(0, 10);

                if (TaxCodeByInvIdent_Search != null && TaxCodeByInvIdent_Search.length > 0 ) {

                    var MESSAGE = {
                        "ES": {
                            title: "Registro Duplicado",
                            message: 'Ya existe un registo con la misma configuración.'
                        },
                        "EN": {
                            title: "Duplicated Record",
                            message: 'There is already a record with the same configuration.'
                        },
                        "PO": {
                            title: "Registro Duplicado",
                            message: 'Já existe um registro com a mesma configuração.'
                        }
                    };

                    message.create({
                        title: MESSAGE[language].title,
                        message: MESSAGE[language].message,
                        type: message.Type.ERROR
                    }).show({ duration: 5000 });

                    return false;

                }

                return true;

            } catch (error) {
                Library_Mail.sendemail('[ saveRecord ]: ' + error, LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ saveRecord ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
            }

        }

        return {
            pageInit: pageInit,
            // fieldChanged: fieldChanged,
            // postSourcing: postSourcing,
            // sublistChanged: sublistChanged,
            // lineInit: lineInit,
            validateField: validateField,
            // validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            saveRecord: saveRecord
        };
    });