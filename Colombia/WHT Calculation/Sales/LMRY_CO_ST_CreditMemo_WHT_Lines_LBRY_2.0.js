/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = \
||   This script for customer center (Time)                           ||
||                                                                    ||
||  File Name: LMRY_CO_ST_CreditMemo_WHT_Lines_LBRY_V2.0.js           ||
||                                                                    ||
||  Version Date         Author        Remarks                        ||
||  2.0     Oct 27 2021  LatamReady    Use Script 2.0                 ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define([
    'N/record',
    'N/search',
    'N/runtime',
    './LMRY_libSendingEmailsLBRY_V2.0',
    './LMRY_Log_LBRY_V2.0'
], function(record, search, runtime, Library_Mail, Library_Log) {

    var LMRY_SCRIPT = "LatamReady - CO ST Credit Memo WHT Lines LBRY 2.0";
    var LMRY_SCRIPT_NAME = "LMRY_CO_ST_CreditMemo_WHT_Lines_LBRY_V2.0.js";

    // FEATURES
    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;
    var FEATURE_APPROVAL = false;

    var MANDATORY_DEPARTMENT = false;
    var MANDATORY_CLASS = false;
    var MANDATORY_LOCATION = false;

    function setWHTLineTransaction(recordObj, scriptContext, licenses) {

        try {

            var type = scriptContext.type;
            var transactionID = recordObj.id;
            var transactionType = recordObj.type;

            if (type == "edit") {
                deleteRelatedRecords(transactionID, transactionType);
            }

            FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
            FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });

            MANDATORY_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
            MANDATORY_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
            MANDATORY_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

            var transactionSubsidiary = "";
            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                transactionSubsidiary = recordObj.getValue({ fieldId: 'subsidiary' });
            } else {
                transactionSubsidiary = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
            }

            var transactionCountry = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
            var transactionDate = recordObj.getText({ fieldId: "trandate" });
            var transactionEntity = recordObj.getValue({ fieldId: "entity" });
            var transactionDocument = recordObj.getValue({ fieldId: "custbody_lmry_document_type" });
            var transactionApprove = recordObj.getValue({ fieldId: "approvalstatus" });

            var STS_Json = _getSetupTaxSubsidiary(transactionSubsidiary);
            var exchageRate = _getExchangeRate(recordObj, transactionSubsidiary, STS_Json);

            var filtroTransactionType = 0;
            switch (transactionType) {
                case "creditmemo":
                    filtroTransactionType = 8;
                    FEATURE_APPROVAL = runtime.getCurrentScript().getParameter({
                        name: 'CUSTOMAPPROVALCUSTINVC'
                    });
                    break;
                // case "vendorbill":
                //     filtroTransactionType = 4;
                //     FEATURE_APPROVAL = runtime.getCurrentScript().getParameter({
                //         name: 'CUSTOMAPPROVALVENDORBILL'
                //     });
                //     break;
                // case "vendorcredit":
                //     filtroTransactionType = 7;
                //     FEATURE_APPROVAL = runtime.getCurrentScript().getParameter({
                //         name: 'CUSTOMAPPROVALVENDORBILL'
                //     });
                //     break;
                default:
                    break;
            }

            var CC_SearchResult = _getContributoryClasses(transactionSubsidiary, transactionDate, filtroTransactionType, transactionDocument, transactionEntity);
            var NT_SearchResult = _getNationalTaxes(transactionSubsidiary, transactionDate, filtroTransactionType, transactionDocument);

            if (FEATURE_APPROVAL == true || FEATURE_APPROVAL == "T") {

                var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
                var whtResult = [];
                var transactionArray = [];
                var journalArray = [];

                if (CC_SearchResult != null && CC_SearchResult.length > 0) {

                    for (var i = 0; i < CC_SearchResult.length; i++) {

                        var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
                        var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
                        var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
                        var CC_whtDescription = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_description" });
                        var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
                        var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
                        var CC_type = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_subtype" });
                        var CC_typeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_subtype" });
                        var CC_subType = CC_SearchResult[i].getText({ name: "custrecord_lmry_sub_type" });
                        var CC_subTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
                        var CC_appliesToItem = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_applies_to_item" });
                        var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_co_ccl_taxrate" });
                        var CC_amountTo = CC_SearchResult[i].getValue({ name: "custrecord_lmry_amount" });
                        var CC_taxItem = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxitem" });
                        var CC_taxCode = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxcode" });
                        var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
                        var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
                        var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
                        var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
                        var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
                        var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
                        var CC_debitAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account1" });
                        var CC_debitAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account1" });
                        var CC_creditAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account2" });
                        var CC_creditAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account2" });

                        if (itemLineCount != null && itemLineCount > 0) {

                            for (var j = 0; j < itemLineCount; j++) {

                                var item = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
                                var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
                                var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
                                var itemApplyWht = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_apply_wht_tax", line: j });

                                if (itemID != CC_appliesToItem) {
                                    continue;
                                }

                                if (!itemApplyWht) {
                                    continue;
                                }

                                var baseAmount = 0;
                                switch (NT_amountTo) {
                                    case "1":
                                        baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: j });
                                        break;
                                    case "2":
                                        baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxamount", line: j });
                                        break;
                                    case "3":
                                        baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j });
                                        break;
                                }

                                var itemWhtAmountoByCC = parseFloat(baseAmount) * parseFloat(CC_taxRate / 100);

                                whtResult.push({
                                    taxtype: {
                                        text: CC_taxType,
                                        value: CC_taxTypeID
                                    },
                                    subtype: {
                                        text: CC_subType,
                                        value: CC_subTypeID
                                    },
                                    lineUniqueKey: itemUniqueKey,
                                    baseamount: parseFloat(baseAmount),
                                    whtamount: Math.round(itemWhtAmountoByCC * 100) / 100,
                                    whtrate: CC_taxRate + "%",
                                    contributoryClass: CC_internalID,
                                    nationalTax: "",
                                    debitaccount: {
                                        text: CC_debitAccount,
                                        value: CC_debitAccountID
                                    },
                                    creditaccount: {
                                        text: CC_creditAccount,
                                        value: CC_creditAccountID
                                    },
                                    generatedtransaction: {
                                        text: CC_generatedTransaction,
                                        value: CC_generatedTransactionID
                                    },
                                    department: {
                                        text: CC_Department,
                                        value: CC_DepartmentID
                                    },
                                    class: {
                                        text: CC_Class,
                                        value: CC_ClassID
                                    },
                                    location: {
                                        text: CC_Location,
                                        value: CC_LocationID
                                    },
                                    item: {
                                        text: item,
                                        value: itemID
                                    },
                                    expenseacc: {},
                                    position: j,
                                    description: CC_whtDescription,
                                    lc_baseamount: parseFloat(baseAmount * exchageRate),
                                    lc_whtamount: parseFloat(itemWhtAmountoByCC * exchageRate)
                                });

                                if ( NT_generatedTransactionID == "5" ) {

                                    var auxTransJson = {
                                        subtype: {
                                            text: CC_subType,
                                            value: CC_subTypeID
                                        },
                                        taxitem: CC_taxItem,
                                        taxcode: CC_taxCode,
                                        department: CC_DepartmentID,
                                        class: CC_ClassID,
                                        location: CC_LocationID,
                                        whtamount: Math.round(itemWhtAmountoByCC * 100) / 100,
                                        description: CC_whtDescription
                                    };
                                    transactionArray.push(auxTransJson);

                                } else if (CC_generatedTransactionID == "1") {

                                    var auxJounarlJson = {
                                        subtype: {
                                            text: CC_subType,
                                            value: CC_subTypeID
                                        },
                                        debitaccount: CC_debitAccountID,
                                        creditaccount: CC_creditAccountID,
                                        department: CC_DepartmentID,
                                        class: CC_ClassID,
                                        location: CC_LocationID,
                                        whtamount: Math.round(itemWhtAmountoByCC * 100) / 100,
                                        description: CC_whtDescription
                                    };

                                    journalArray.push(auxJounarlJson);

                                }

                            } // Fin for itemLineCount

                        } // Fin if itemLineCount

                    } // Fin for CC

                } else { // Fin if CC_SearchResult

                    if (NT_SearchResult != null && NT_SearchResult.length > 0) {

                        for (var i = 0; i < NT_SearchResult.length; i++) {

                            var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
                            var NT_generatedTransaction = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
                            var NT_generatedTransactionID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
                            var NT_whtDescription = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_description" });
                            var NT_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_taxtype" });
                            var NT_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxtype" });
                            var NT_type = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_subtype" });
                            var NT_typeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_subtype" });
                            var NT_subType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_sub_type" });
                            var NT_subTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_sub_type" });
                            var NT_appliesToItem = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_applies_to_item" });
                            var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_co_ntax_taxrate" });
                            var NT_amountTo = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_amount" });
                            var NT_taxItem = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxitem" });
                            var NT_taxCode = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxcode" });
                            var NT_Department = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_department" });
                            var NT_DepartmentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_department" });
                            var NT_Class = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_class" });
                            var NT_ClassID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_class" });
                            var NT_Location = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_location" });
                            var NT_LocationID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_location" });
                            var NT_debitAccount = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_debit_account" });
                            var NT_debitAccountID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_debit_account" });
                            var NT_creditAccount = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_credit_account" });
                            var NT_creditAccountID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_credit_account" });

                            if (itemLineCount != null && itemLineCount > 0) {

                                for (var j = 0; j < itemLineCount; j++) {

                                    var item = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
                                    var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
                                    var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
                                    var itemApplyWht = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_apply_wht_tax", line: j });

                                    if (itemID != NT_appliesToItem) {
                                        continue;
                                    }

                                    if (!itemApplyWht) {
                                        continue;
                                    }

                                    var baseAmount = 0;
                                    switch (NT_amountTo) {
                                        case "1":
                                            baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: j });
                                            break;
                                        case "2":
                                            baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxamount", line: j });
                                            break;
                                        case "3":
                                            baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j });
                                            break;
                                    }

                                    var itemWhtAmountoByNT = parseFloat(baseAmount) * parseFloat(NT_taxRate / 100);

                                    whtResult.push({
                                        taxtype: {
                                            text: NT_taxType,
                                            value: NT_taxTypeID
                                        },
                                        subtype: {
                                            text: NT_subType,
                                            value: NT_subTypeID
                                        },
                                        lineUniqueKey: itemUniqueKey,
                                        baseamount: parseFloat(baseAmount),
                                        whtamount: Math.round(itemWhtAmountoByNT * 100) / 100,
                                        whtrate: NT_taxRate + "%",
                                        contributoryClass: "",
                                        nationalTax: NT_internalID,
                                        debitaccount: {
                                            text: NT_debitAccount,
                                            value: NT_debitAccountID
                                        },
                                        creditaccount: {
                                            text: NT_creditAccount,
                                            value: NT_creditAccountID
                                        },
                                        generatedtransaction: {
                                            text: NT_generatedTransaction,
                                            value: NT_generatedTransactionID
                                        },
                                        department: {
                                            text: NT_Department,
                                            value: NT_DepartmentID
                                        },
                                        class: {
                                            text: NT_Class,
                                            value: NT_ClassID
                                        },
                                        location: {
                                            text: NT_Location,
                                            value: NT_LocationID
                                        },
                                        item: {
                                            text: item,
                                            value: itemID
                                        },
                                        expenseacc: {},
                                        position: j,
                                        description: NT_whtDescription,
                                        lc_baseamount: parseFloat(baseAmount * exchageRate),
                                        lc_whtamount: parseFloat(itemWhtAmountoByNT * exchageRate)
                                    });

                                    if ( NT_generatedTransactionID == "5" ) {

                                        var auxTransJson = {
                                            subtype: {
                                                text: NT_subType,
                                                value: NT_subTypeID
                                            },
                                            taxitem: NT_taxItem,
                                            taxcode: NT_taxCode,
                                            department: NT_DepartmentID,
                                            class: NT_ClassID,
                                            location: NT_LocationID,
                                            whtamount: Math.round(itemWhtAmountoByNT * 100) / 100,
                                            description: NT_whtDescription
                                        };
                                        transactionArray.push(auxTransJson);

                                    } else if (NT_generatedTransactionID == "1") {

                                        var auxJounarlJson = {
                                            subtype: {
                                                text: NT_subType,
                                                value: NT_subTypeID
                                            },
                                            debitaccount: NT_debitAccountID,
                                            creditaccount: NT_creditAccountID,
                                            department: NT_DepartmentID,
                                            class: NT_ClassID,
                                            location: NT_LocationID,
                                            whtamount: Math.round(itemWhtAmountoByNT * 100) / 100,
                                            description: NT_whtDescription
                                        };

                                        journalArray.push(auxJounarlJson);

                                    }

                                } // Fin for itemLineCount

                            } // Fin if itemLineCount

                        } // Fin for NT_SearchResult

                    } // Fin if NT_SearchResult

                }

                var reteIVA = 0;
                var reteICA = 0;
                var reteFTE = 0;
                var reteCREE = 0;

                for (var whtdetail in transactionArray) {
                    switch (transactionArray[whtdetail].subtype.value) {
                        case "18":
                            reteIVA += transactionArray[whtdetail].whtamount;
                            break;
                        case "19":
                            reteICA += transactionArray[whtdetail].whtamount;
                            break;
                        case "20":
                            reteCREE += transactionArray[whtdetail].whtamount;
                            break;
                        case "21":
                            reteFTE += transactionArray[whtdetail].whtamount;
                            break;
                    }
                }

                for (var whtdetail in journalArray) {
                    switch (journalArray[whtdetail].subtype.value) {
                        case "18":
                            reteIVA += journalArray[whtdetail].whtamount;
                            break;
                        case "19":
                            reteICA += journalArray[whtdetail].whtamount;
                            break;
                        case "20":
                            reteCREE += journalArray[whtdetail].whtamount;
                            break;
                        case "21":
                            reteFTE += journalArray[whtdetail].whtamount;
                            break;
                    }
                }

                record.submitFields({
                    type: transactionType,
                    id: transactionID,
                    values: {
                        "custbody_lmry_co_reteiva_amount": reteIVA,
                        "custbody_lmry_co_reteica_amount": reteICA,
                        "custbody_lmry_co_retecree_amount": reteCREE,
                        "custbody_lmry_co_retefte_amount": reteFTE
                    },
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });

                _createWhtTransaction(recordObj, transactionID, transactionType, transactionArray, STS_Json, exchageRate, licenses);
                _createWhtJournal(recordObj, transactionID, journalArray, STS_Json, exchageRate, licenses);
                _saveWhtResult(transactionID, transactionSubsidiary, transactionCountry, whtResult);


            } else {
                Library_Mail.sendemail('[ setWHTLinesTransaction ]: The approval routing for the transaction is disabled. ', LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ afterSubmit - setWHTLinesTransaction ]', message: "The approval routing for the transaction is disabled.", relatedScript: LMRY_SCRIPT_NAME });

                return true;
            }

        } catch (e) {
            Library_Mail.sendemail('[ setWHTLinesTransaction ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - setWHTLinesTransaction ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Funcion que elimina los Journal y Registros del record
     * LatamReady - LatamTax Tax Results" en caso se elimine la transacción
     * llamada desde el User Event del Invoice, Credit Memo, Bill y Bill Credit
     *    - transactionID: ID de la transaccion
     *    - transactionType: Tipo de transaccion
     ***************************************************************************/
    function deleteRelatedRecords(transactionID, transactionType) {

        try {

            // BUSQUEDA DE TRANSACCIONES RELACIONADAS
            var relatedIDs = [];
            var Transaction_Search = search.create({
                type: "invoice",
                columns: ["internalid"],
                filters: [
                    ["custbody_lmry_reference_transaction", "IS", transactionID], "AND",
                    ["mainline", "IS", "T"]
                ]
            });

            var Transaction_SearchResult = Transaction_Search.run().getRange(0, 1000);
            if (Transaction_SearchResult != null && Transaction_SearchResult.length > 0) {
                for (var i = 0; i < Transaction_SearchResult.length; i++) {
                    relatedIDs.push(Number(Transaction_SearchResult[i].getValue("internalid")));
                }
            }

            if (relatedIDs.length > 0) {

                var recordObj = record.load({
                    type: "creditmemo",
                    id: transactionID
                });

                var applyLineCount = recordObj.getLineCount({ sublistId: "apply" });
                for (var i = 0; i < applyLineCount; i++) {
                    var applyTransactionID = recordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                    if (relatedIDs.indexOf(Number(applyTransactionID)) != -1) {
                        recordObj.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: false });
                    }
                }

                recordObj.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

            }

            for (var i = 0; i < relatedIDs.length; i++) {
                record.delete({
                    type: "invoice",
                    id: relatedIDs[i]
                });
            }

            // BUSQUEDA DE JOURNALA ENTRY RELACIONADOS
            var JE_Search = search.create({
                type: search.Type.JOURNAL_ENTRY,
                columns: ["internalid"],
                filters: [
                    ["custbody_lmry_reference_transaction", "IS", transactionID]
                ]
            });

            var JE_SearchResult = JE_Search.run().getRange(0, 1000);
            var auxID = 0;
            if (JE_SearchResult != null && JE_SearchResult.length != 0) {
                for (var i = 0; i < JE_SearchResult.length; i++) {
                    var JE_ID = JE_SearchResult[i].getValue("internalid");
                    if (auxID != JE_ID) {
                        auxID = JE_ID;
                        record.delete({
                            type: record.Type.JOURNAL_ENTRY,
                            id: JE_ID
                        });
                    }
                }
            }

        } catch (e) {
            Library_Mail.sendemail('[ deleteRelatedRecords ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ deleteRelatedRecords ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * GUARDAR UN REGISTRO EN EL RECORD: LATMAREADY - LATAMTAX TAX RESULT
     *    - recordID: ID de la transacción
     *    - subsidiary: ID de la subsidiaria
     *    - countryID: ID del país
     *    - whtResult: Arreglo de JSON con los detalles de las retenciones
     ***************************************************************************/
    function _saveWhtResult(recordID, subsidiary, countryID, whtResult) {

        try {

            var taxResultSearch = search.create({
                type: "customrecord_lmry_latamtax_tax_result",
                columns: ["internalid"],
                filters: [
                    ["custrecord_lmry_tr_related_transaction", "IS", recordID]
                ]
            }).run().getRange(0, 10);

            if (taxResultSearch != null && taxResultSearch.length > 0) {

                var taxResultID = taxResultSearch[0].getValue({ name: "internalid" });

                record.submitFields({
                    type: "customrecord_lmry_latamtax_tax_result",
                    id: taxResultID,
                    values: {
                        "custrecord_lmry_tr_subsidiary": subsidiary,
                        "custrecord_lmry_tr_country": countryID,
                        "custrecord_lmry_tr_wht_transaction": JSON.stringify(whtResult)
                    },
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });

            } else {

                var TR_Record = record.create({
                    type: "customrecord_lmry_latamtax_tax_result",
                    isDynamic: false
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_tr_related_transaction",
                    value: recordID
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_tr_subsidiary",
                    value: subsidiary
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_tr_country",
                    value: countryID
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_tr_wht_transaction",
                    value: JSON.stringify(whtResult)
                });

                var recordSave = TR_Record.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

            }

        } catch (e) {
            Library_Mail.sendemail('[ _saveWhtResult ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _saveWhtResult ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * GUARDAR UN REGISTRO EN EL RECORD: Transaction
     *    - recordObj: Record cargado del cual saldrá la data
     *    - transactionID: ID de la transaccion
     *    - journalArray: Detalle de las reteciones por tipo
     *    - STS_Json: Json con data del record LatamReady - Setup Tax Subsidiary
     *    - exchageRate: Tipo de cambio
     ***************************************************************************/
    function _createWhtJournal (recordObj, transactionID, journalArray, STS_Json, exchageRate, licenses) {

        try {

            var transactionForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_journal_entry" });
            var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
            var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
            var transactionDate = recordObj.getValue({ fieldId: "trandate" });
            var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
            var transactionEntity = recordObj.getValue({ fieldId: "entity" });
            var transactionDeparment = recordObj.getValue({ fieldId: "department" });
            var transactionClass = recordObj.getValue({ fieldId: "class" });
            var transactionLocation = recordObj.getValue({ fieldId: "location" });

            if (Library_Mail.getAuthorization(376, licenses)) {

                var whtDetailJson = {};
                for (var whtdetail in journalArray) {

                    if(!whtDetailJson[journalArray[whtdetail].subtype.text]) {
                        whtDetailJson[journalArray[whtdetail].subtype.text] = [];
                    }
                    whtDetailJson[journalArray[whtdetail].subtype.text].push(journalArray[whtdetail]);

                }

                for (var whtdetail in whtDetailJson) {

                    var newRecordObj = record.create({
                        type: record.Type.JOURNAL_ENTRY,
                        isDynamic: true
                    });

                    newRecordObj.setValue({ fieldId: "customform", value: transactionForm });
                    newRecordObj.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
                    newRecordObj.setValue({ fieldId: "currency", value: transactionCurrency });
                    newRecordObj.setValue({ fieldId: "exchangerate", value: exchageRate });
                    newRecordObj.setValue({ fieldId: "trandate", value: transactionDate });
                    newRecordObj.setValue({ fieldId: "memo", value: "Latam - STE CO WHT " + whtdetail + " (Lines)" });
                    newRecordObj.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                    var newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
                    var newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
                    var newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;

                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "approvalstatus", value: 2 });

                    for (var wht in whtDetailJson[whtdetail]) {

                        newRecordObj.selectNewLine({ sublistId: "line" });
                        if (recordObj.type == "invoice") {
                            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson[whtdetail][wht].debitaccount });
                        } else if (recordObj.type == "creditmemo") {
                            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson[whtdetail][wht].creditaccount });
                        }
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: whtDetailJson[whtdetail][wht].whtamount });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: whtDetailJson[whtdetail][wht].description });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                        newRecordObj.commitLine({ sublistId: "line" });

                        newRecordObj.selectNewLine({ sublistId: "line" });
                        if (recordObj.type == "invoice") {
                            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson[whtdetail][wht].creditaccount });
                        } else if (recordObj.type == "creditmemo") {
                            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson[whtdetail][wht].debitaccount });
                        }
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: whtDetailJson[whtdetail][wht].whtamount });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: whtDetailJson[whtdetail][wht].description });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                        newRecordObj.commitLine({ sublistId: "line" });

                    }

                    var newTransactionID = newRecordObj.save({
                      ignoreMandatoryFields: true,
                      disableTriggers: true,
                      enableSourcing: true
                    });

                }

            } else {

                for (var whtdetail in journalArray) {

                    var newRecordObj = record.create({
                        type: record.Type.JOURNAL_ENTRY,
                        isDynamic: true
                    });

                    newRecordObj.setValue({ fieldId: "customform", value: transactionForm });
                    newRecordObj.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
                    newRecordObj.setValue({ fieldId: "currency", value: transactionCurrency });
                    newRecordObj.setValue({ fieldId: "exchangerate", value: exchageRate });
                    newRecordObj.setValue({ fieldId: "trandate", value: transactionDate });
                    newRecordObj.setValue({ fieldId: "memo", value: "Latam - STE CO WHT " + journalArray[whtdetail].subtype.text + " (Lines)" });
                    newRecordObj.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                    var newDeparment = "";
                    var newClass = "";
                    var newLocation = "";
                    if (STS_Json.depclassloc == true || STS_Json.depclassloc == "T") {
                        newDeparment = journalArray[whtdetail].department;
                        newClass = journalArray[whtdetail].class;
                        newLocation = journalArray[whtdetail].location;
                    } else {
                        newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
                        newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
                        newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
                    }

                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "approvalstatus", value: 2 });

                    // Lines
                    newRecordObj.selectNewLine({ sublistId: "line" });
                    if (recordObj.type == "invoice") {
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: journalArray[whtdetail].debitaccount });
                    } else if (recordObj.type == "creditmemo") {
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: journalArray[whtdetail].creditaccount });
                    }
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: journalArray[whtdetail].whtamount });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: journalArray[whtdetail].description });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                    newRecordObj.commitLine({ sublistId: "line" });

                    newRecordObj.selectNewLine({ sublistId: "line" });
                    if (recordObj.type == "invoice") {
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: journalArray[whtdetail].creditaccount });
                    } else if (recordObj.type == "creditmemo") {
                        newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: journalArray[whtdetail].debitaccount });
                    }
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: journalArray[whtdetail].whtamount });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: journalArray[whtdetail].description });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                    newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                    newRecordObj.commitLine({ sublistId: "line" });

                    var newTransactionID = newRecordObj.save({
                      ignoreMandatoryFields: true,
                      disableTriggers: true,
                      enableSourcing: true
                    });

                }

            }

        } catch (e) {
            Library_Mail.sendemail('[ _createWhtJournal ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _createWhtJournal ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * GUARDAR UN REGISTRO EN EL RECORD: Transaction
     *    - recordObj: Record cargado del cual saldrá la data
     *    - transactionID: ID de la transaccion
     *    - transactionType: Tipo de la transaction ("invoice" o "credit memo")
     *    - transactionArray: Detalle de las reteciones por tipo
     *    - STS_Json: Json con data del record LatamReady - Setup Tax Subsidiary
     *    - exchageRate: Tipo de cambio
     ***************************************************************************/
    function _createWhtTransaction (recordObj, transactionID, transactionType, transactionArray, STS_Json, exchageRate, licenses) {

        try {

            var toTransaction = "invoice";
            var transactionForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_invoice" });

            var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
            var transactionEntity = recordObj.getValue({ fieldId: "entity" });
            var transactionDate = recordObj.getValue({ fieldId: "trandate" });
            var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
            var transactionAccount = recordObj.getValue({ fieldId: "account" });
            var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
            var transactionDeparment = recordObj.getValue({ fieldId: "department" });
            var transactionClass = recordObj.getValue({ fieldId: "class" });
            var transactionLocation = recordObj.getValue({ fieldId: "location" });
            var transactionEntityTaxRegNumer = recordObj.getValue({ fieldId: "entitytaxregnum" });
            var transactionNexusOverride = recordObj.getValue({ fieldId: "taxregoverride" });

            if (transactionNexusOverride == true || transactionNexusOverride == "T") {
                var transactionNexus = recordObj.getValue({ fieldId: "nexus" });
            }

            var newRecordArray = [];
            if (Library_Mail.getAuthorization(376, licenses)) { // Feature Use Group para agrupar los impuestos

                var whtDetailJson = {};
                for (var whtdetail in transactionArray) {

                    if(!whtDetailJson[transactionArray[whtdetail].subtype.text]) {
                        whtDetailJson[transactionArray[whtdetail].subtype.text] = [];
                    }
                    whtDetailJson[transactionArray[whtdetail].subtype.text].push(transactionArray[whtdetail]);

                }

                for (var whtdetail in whtDetailJson) {

                    var newRecordObj = record.create({
                        type:toTransaction,
                        isDynamic: true
                    });

                    // Body Fields
                    newRecordObj.setValue({ fieldId: "customform", value: transactionForm });
                    newRecordObj.setValue({ fieldId: "entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
                    newRecordObj.setValue({ fieldId: "memo", value: "Latam - STE CO WHT " + whtdetail + " (Lines)" });
                    newRecordObj.setValue({ fieldId: "trandate", value: transactionDate });
                    newRecordObj.setValue({ fieldId: "postingperiod", value: transactionPeriod });
                    newRecordObj.setValue({ fieldId: "account", value: transactionAccount });
                    newRecordObj.setValue({ fieldId: "exchangerate", value: exchageRate });
                    newRecordObj.setValue({ fieldId: "currency", value: transactionCurrency });
                    newRecordObj.setValue({ fieldId: "taxdetailsoverride", value: true });
                    newRecordObj.setValue({ fieldId: "entitytaxregnum", value: transactionEntityTaxRegNumer });
                    if (transactionNexusOverride == true || transactionNexusOverride == "T") {
                        newRecordObj.setValue({ fieldId: "nexus", value: transactionNexus });
                    }

                    var newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
                    var newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
                    var newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;

                    newRecordObj.setValue({ fieldId: "department", value: newDeparment });
                    newRecordObj.setValue({ fieldId: "class", value: newClass });
                    newRecordObj.setValue({ fieldId: "location", value: newLocation });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "approvalstatus", value: 2 });

                    for (var wht in whtDetailJson[whtdetail]) {

                        newRecordObj.selectNewLine({ sublistId: "item" });
                        newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: whtDetailJson[whtdetail][wht].taxitem });
                        newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: 1 });
                        newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "description", value: whtDetailJson[whtdetail][wht].description });
                        newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: whtDetailJson[whtdetail][wht].whtamount });
                        newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "amount", value: whtDetailJson[whtdetail][wht].whtamount });
                        newRecordObj.commitLine({ sublistId: "item" });

                    }

                    var newItemLine = 0;
                    for (var wht in whtDetailJson[whtdetail]) {

                        var itemDetailReference = newRecordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: newItemLine });

                        // Tax Details
                        newRecordObj.selectNewLine({ sublistId: "taxdetails" });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: _getTaxTypeByTaxCode(whtDetailJson[whtdetail][wht].taxcode) });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: whtDetailJson[whtdetail][wht].taxcode });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: whtDetailJson[whtdetail][wht].whtamount });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: 0 });
                        newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0 });
                        newRecordObj.commitLine({ sublistId: "taxdetails" });

                        newItemLine += 1;

                    }

                    newTransactionID = newRecordObj.save({
                        ignoreMandatoryFields: true,
                        disableTriggers: true,
                        enableSourcing: true
                    });

                    newRecordArray.push(Number(newTransactionID));

                }

            } else {

                for (var whtdetail in transactionArray) {

                    var newRecordObj = record.create({
                        type: toTransaction,
                        isDynamic: true
                    });
                    // Body Fields
                    newRecordObj.setValue({ fieldId: "customform", value: transactionForm });
                    newRecordObj.setValue({ fieldId: "entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
                    newRecordObj.setValue({ fieldId: "memo", value: "Latam - STE CO WHT " + transactionArray[whtdetail].subtype.text + " (Lines)" });
                    newRecordObj.setValue({ fieldId: "trandate", value: transactionDate });
                    newRecordObj.setValue({ fieldId: "postingperiod", value: transactionPeriod });
                    newRecordObj.setValue({ fieldId: "account", value: transactionAccount });
                    newRecordObj.setValue({ fieldId: "exchangerate", value: exchageRate });
                    newRecordObj.setValue({ fieldId: "currency", value: transactionCurrency });
                    newRecordObj.setValue({ fieldId: "taxdetailsoverride", value: true });
                    newRecordObj.setValue({ fieldId: "entitytaxregnum", value: transactionEntityTaxRegNumer });
                    if (transactionNexusOverride == true || transactionNexusOverride == "T") {
                        newRecordObj.setValue({ fieldId: "nexus", value: transactionNexus });
                    }

                    var newDeparment = "";
                    var newClass = "";
                    var newLocation = "";
                    if (STS_Json.depclassloc == true || STS_Json.depclassloc == "T") {
                        newDeparment = transactionArray[whtdetail].department;
                        newClass = transactionArray[whtdetail].class;
                        newLocation = transactionArray[whtdetail].location;
                    } else {
                        newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
                        newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
                        newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
                    }

                    newRecordObj.setValue({ fieldId: "department", value: newDeparment });
                    newRecordObj.setValue({ fieldId: "class", value: newClass });
                    newRecordObj.setValue({ fieldId: "location", value: newLocation });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                    newRecordObj.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity });
                    newRecordObj.setValue({ fieldId: "approvalstatus", value: 2 });

                    // Items
                    newRecordObj.selectNewLine({ sublistId: "item" });
                    newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: transactionArray[whtdetail].taxitem });
                    newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: 1 });
                    newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "description", value: transactionArray[whtdetail].description });
                    newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: transactionArray[whtdetail].whtamount });
                    newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "amount", value: transactionArray[whtdetail].whtamount });
                    newRecordObj.commitLine({ sublistId: "item" });

                    var itemDetailReference = newRecordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: 0 });

                    // Tax Details
                    newRecordObj.selectNewLine({ sublistId: "taxdetails" });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: _getTaxTypeByTaxCode(transactionArray[whtdetail].taxcode) });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: transactionArray[whtdetail].taxcode });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: transactionArray[whtdetail].whtamount });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: 0 });
                    newRecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0 });
                    newRecordObj.commitLine({ sublistId: "taxdetails" });

                    newTransactionID = newRecordObj.save({
                        ignoreMandatoryFields: true,
                        disableTriggers: true,
                        enableSourcing: true
                    });

                    newRecordArray.push(Number(newTransactionID));

                }

            }

            _applyTransaction (newRecordArray, recordObj);

        } catch (e) {
            Library_Mail.sendemail('[ _createWhtTransaction ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _createWhtTransaction ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Aplicar las notas de creditar a la transaccion
     *    - newRecordArray: Ids de la transacciones creadas
     *    - recordObj: Registro del record base
     ***************************************************************************/
    function _applyTransaction (newRecordArray, recordObj) {

        try {

            var newRecordObj = record.load({
                type: recordObj.type,
                id: recordObj.id
            });

            var applyLineCount = newRecordObj.getLineCount({ sublistId: "apply" });
            var totalAmount = newRecordObj.getValue({ fieldId: "total" });

            for (var i = 0; i < applyLineCount; i++) {
                var applyTransactionID = newRecordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                if (newRecordArray.indexOf(Number(applyTransactionID)) != -1) {
                    newRecordObj.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: true });
                    newRecordObj.setSublistValue({ sublistId: "apply", fieldId: "amount", line: i, value: totalAmount });
                }
            }

            newRecordObj.save({
                ignoreMandatoryFields: true,
                disableTriggers: true,
                enableSourcing: true
            });

        } catch (e) {
            Library_Mail.sendemail('[ _applyTransaction ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _applyTransaction ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: Tax Code
     *    - taxCode: ID del Tax Code
     ***************************************************************************/
    function _getTaxTypeByTaxCode (taxCode) {

        try {

            var taxType = search.lookupFields({
                type: "salestaxitem",
                id: taxCode,
                columns: [ "custrecord_lmry_ste_setup_tax_type" ]
            }).custrecord_lmry_ste_setup_tax_type[0].value;

            return taxType;

        } catch (e) {
            Library_Mail.sendemail('[ _getTaxTypeByTaxCode ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getTaxTypeByTaxCode ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
     *    - transactionSubsidiary: Subsiaria
     *    - transactionDate: Fecha de creación de la transacción
     *    - filtroTransactionType: Invoice / Credit Memo
     *    - transactionDocument: Tipo de Documento Fiscal
     ***************************************************************************/
    function _getNationalTaxes(transactionSubsidiary, transactionDate, filtroTransactionType, transactionDocument) {

        try {

            var NT_Columns = [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "custrecord_lmry_ntax_gen_transaction", label: "Latam - Generated Transaction?" }),
                search.createColumn({ name: "custrecord_lmry_ntax_description", label: "Latam - Withholding Description" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxtype", label: "Latam - Tax Type" }),
                search.createColumn({ name: "custrecord_lmry_ntax_subtype", label: "Latam - Type" }),
                search.createColumn({ name: "custrecord_lmry_ntax_sub_type", label: "Latam - Sub Type" }),
                search.createColumn({ name: "custrecord_lmry_ntax_applies_to_item", label: "Latam - Applies to Item" }),
                search.createColumn({ name: "custrecord_lmry_ntax_applies_to_account", label: "Latam - Apllies to Account" }),
                search.createColumn({ name: "custrecord_lmry_co_ntax_taxrate", label: "Latam - Tax Rate" }),
                search.createColumn({ name: "custrecord_lmry_ntax_amount", label: "Latam - Amount to" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxitem", label: "Latam - Tax Item" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxcode", label: "Latam - Tax Code" }),
                search.createColumn({ name: "custrecord_lmry_ntax_department", label: "Latam - Department" }),
                search.createColumn({ name: "custrecord_lmry_ntax_class", label: "Latam - Class" }),
                search.createColumn({ name: "custrecord_lmry_ntax_location", label: "Latam - Location" }),
                search.createColumn({ name: "custrecord_lmry_ntax_credit_account", label: "Latam - Credit Account" }),
                search.createColumn({ name: "custrecord_lmry_ntax_debit_account", label: "Latam - Debit Account" })
            ];

            // search.createColumn({ name: "custrecord_lmry_ntax_addratio", label: "Latam - Additional Ratio" });
            // search.createColumn({ name: "custrecord_lmry_ntax_minamount", label: "Latam - Min Amount" });
            // search.createColumn({ name: "custrecord_lmry_ntax_maxamount", label: "Latam - Max Amount" });
            // search.createColumn({ name: "custrecord_lmry_ntax_set_baseretention", label: "Latam - Set Base Retention" });
            // search.createColumn({ name: "custrecord_lmry_ntax_base_amount", label: "Latam - Base Amount?" });
            // search.createColumn({ name: "custrecord_lmry_ntax_not_taxable_minimum", label: "Latam - Not Taxable Minimum" });

            var NT_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] }),
                search.createFilter({ name: "custrecord_lmry_ntax_datefrom", operator: "ONORBEFORE", values: [transactionDate] }),
                search.createFilter({ name: "custrecord_lmry_ntax_dateto", operator: "ONORAFTER", values: [transactionDate] }),
                search.createFilter({ name: "custrecord_lmry_ntax_transactiontypes", operator: "ANYOF", values: [filtroTransactionType] }),
                search.createFilter({ name: "custrecord_lmry_ntax_appliesto", operator: "ANYOF", values: ["2"] }), // Lineas
                search.createFilter({ name: "custrecord_lmry_ntax_taxtype", operator: "ANYOF", values: ["1"] }), // Retenciones
                search.createFilter({ name: "custrecord_lmry_ntax_gen_transaction", operator: "ANYOF", values: ["1", "5"] }) // Journal or WHT by Transaction
            ];

            var documents = [ "@NONE@" ];
            if (transactionDocument) {
                documents.push(transactionDocument);
            }
            NT_Filters.push( search.createFilter({ name: "custrecord_lmry_ntax_fiscal_doctype", operator: "ANYOF", values: documents }) );

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                NT_Filters.push( search.createFilter({ name: "custrecord_lmry_ntax_subsidiary", operator: "ANYOF", values: [transactionSubsidiary] }) );
            }

            var NT_SearchResult = search.create({
                type: "customrecord_lmry_national_taxes",
                columns: NT_Columns,
                filters: NT_Filters
            }).run().getRange(0, 1000);

            return NT_SearchResult;

        } catch (e) {
            Library_Mail.sendemail('[ _getNationalTaxes ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getNationalTaxes ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
     *    - transactionSubsidiary: Subsiaria
     *    - transactionDate: Fecha de creación de la transacción
     *    - filtroTransactionType: Invoice / Credit Memo
     *    - transactionDocument: Tipo de Documento Fiscal
     *    - transactionEntity: ID de la Entidad
     ***************************************************************************/
    function _getContributoryClasses(transactionSubsidiary, transactionDate, filtroTransactionType, transactionDocument, transactionEntity) {

        try {

            var CC_Columns = [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "custrecord_lmry_ccl_gen_transaction", label: "Latam - Generated Transaction?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_description", label: "Latam - Withholding Description" }),
                search.createColumn({ name: "custrecord_lmry_ccl_taxtype", label: "Latam - Tax Type" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_subtype", label: "Latam - Type" }),
                search.createColumn({ name: "custrecord_lmry_sub_type", label: "Latam - Sub Type" }),
                search.createColumn({ name: "custrecord_lmry_ccl_applies_to_item", label: "Latam - Applies to Item" }),
                search.createColumn({ name: "custrecord_lmry_ccl_applies_to_account", label: "Latam - Apllies to Account" }),
                search.createColumn({ name: "custrecord_lmry_co_ccl_taxrate", label: "Latam - Tax Rate" }),
                search.createColumn({ name: "custrecord_lmry_amount", label: "Latam - Amount to" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_taxitem", label: "Latam - Tax Item" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_taxcode", label: "Latam - Tax Code" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_department", label: "Latam - Department" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_class", label: "Latam - Class" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_location", label: "Latam - Location" }),
                search.createColumn({ name: "custrecord_lmry_br_ccl_account2", label: "Latam - Credit Account" }),
                search.createColumn({ name: "custrecord_lmry_br_ccl_account1", label: "Latam - Debit Account" })
            ];

            // CC_Columns[8] = search.createColumn({ name: "custrecord_lmry_ccl_addratio", label: "Latam - Additional Ratio" });
            // CC_Columns[9] = search.createColumn({ name: "custrecord_lmry_ccl_minamount", label: "Latam - Min Amount" });
            // CC_Columns[10] = search.createColumn({ name: "custrecord_lmry_ccl_maxamount", label: "Latam - Max Amount" });
            // CC_Columns[11] = search.createColumn({ name: "custrecord_lmry_ccl_set_baseretention", label: "Latam - Set Base Retention" });
            // CC_Columns[12] = search.createColumn({ name: "custrecord_lmry_ccl_base_amount", label: "Latam - Base Amount?" });
            // CC_Columns[13] = search.createColumn({ name: "custrecord_lmry_ccl_not_taxable_minimum", label: "Latam - Not Taxable Minimum" });

            var CC_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] }),
                search.createFilter({ name: "custrecord_lmry_ar_ccl_fechdesd", operator: "ONORBEFORE", values: [transactionDate] }),
                search.createFilter({ name: "custrecord_lmry_ar_ccl_fechhast", operator: "ONORAFTER", values: [transactionDate] }),
                search.createFilter({ name: "custrecord_lmry_ccl_transactiontypes", operator: "ANYOF", values: [filtroTransactionType] }),
                search.createFilter({ name: "custrecord_lmry_ar_ccl_entity", operator: "ANYOF", values: [transactionEntity] }),
                search.createFilter({ name: "custrecord_lmry_ccl_appliesto", operator: "ANYOF", values: ["2"] }), // Lineas
                search.createFilter({ name: "custrecord_lmry_ccl_taxtype", operator: "ANYOF", values: ["1"] }), // Retenciones
                search.createFilter({ name: "custrecord_lmry_ccl_gen_transaction", operator: "ANYOF", values: ["1", "5"] }) // Journal or WHT by Transaction
            ];

            var documents = [ "@NONE@" ];
            if (transactionDocument) {
                documents.push(transactionDocument);
            }
            CC_Filters.push( search.createFilter({ name: "custrecord_lmry_ccl_fiscal_doctype", operator: "ANYOF", values: documents }) );

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                CC_Filters.push( search.createFilter({ name: "custrecord_lmry_ar_ccl_subsidiary", operator: "ANYOF", values: [transactionSubsidiary] }) );
            }

            var CC_SearchResult = search.create({
                type: "customrecord_lmry_ar_contrib_class",
                columns: CC_Columns,
                filters: CC_Filters
            }).run().getRange(0, 1000);

            return CC_SearchResult;

        } catch (e) {
            Library_Mail.sendemail('[ _getContributoryClasses ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getContributoryClasses ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * FUNCION PARA OBTENER EL TIPO DE CAMBIO CON EL QUE SE VAN A REALIZAR LOS
     * CALLCULOS DE IMPUESTOS
     *    - recordObj: Registro de la transaccion
     *    - subsidiary: Subsidiaria de transaccion
     *    - STS_Json: Json con campos del record LatamReady - Setup Tax Subsidiary
     ***************************************************************************/
    function _getExchangeRate(recordObj, subsidiary, STS_Json) {

        try {

            var transactionExchangeRate = recordObj.getValue({
                fieldId: "exchangerate"
            });

            var exchangeRate = 1;
            if ((FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") && (FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T")) {

                var subsiadiarySearch = search.lookupFields({
                    type: "subsidiary",
                    id: subsidiary,
                    columns: ["currency"]
                });

                var subsidiaryCurrency = subsiadiarySearch.currency[0].value;
                if ((subsidiaryCurrency != STS_Json.currency) && (STS_Json.currency != "" && STS_Json.currency != null)) {

                    var bookLineCount = recordObj.getLineCount({
                        sublistId: "accountingbookdetail"
                    });
                    if (bookLineCount != "" && bookLineCount != null) {

                        for (var i = 0; i < bookLineCount; i++) {

                            var bookCurrency = recordObj.getSublistValue({
                                sublistId: "accountingbookdetail",
                                fieldId: "currency",
                                line: i
                            });
                            if (bookCurrency == STS_Json.currency) {
                                exchangerate = recordObj.getSublistValue({
                                    sublistId: "accountingbookdetail",
                                    fieldId: "exchangerate",
                                    line: i
                                });
                                break;
                            }

                        }

                    }

                } else {
                    exchangeRate = transactionExchangeRate;
                }

            } else {
                exchangeRate = transactionExchangeRate;
            }

            return exchangeRate;

        } catch (e) {
            Library_Mail.sendemail('[ _getExchangeRate ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getExchangeRate ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY
     *    - subsidiary: Subsiaria a filtrar para recuperar su configuración
     ***************************************************************************/
    function _getSetupTaxSubsidiary(subsidiary) {

        try {

            var STS_Columns = [
                search.createColumn({ name: "custrecord_lmry_setuptax_subsidiary", label: "Latam - Subsidiary" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_currency", label: "Latam - Currency" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_depclassloc", label: "Latam - Department, Class & Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_department", label: "Latam - Department" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_class", label: "Latam - Class" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_location", label: "Latam - Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_journal", label: "Latam - Journal Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_creditmemo", label: "Latam - Credit Memo Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_invoice", label: "Latam - Invoice Form" })
            ];

            var STS_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
            ];

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                STS_Filters.push( search.createFilter({ name: "custrecord_lmry_setuptax_subsidiary", operator: "ANYOF", values: [subsidiary] }) );
            }

            var STS_Search = search.create({
                type: "customrecord_lmry_setup_tax_subsidiary",
                columns: STS_Columns,
                filters: STS_Filters
            });

            var STS_SearchResult = STS_Search.run().getRange(0, 10);
            var STS_Json = {};
            if (STS_SearchResult != null && STS_SearchResult.length > 0) {

                STS_Json["subsidiary"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_subsidiary" });
                STS_Json["currency"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_currency" });
                STS_Json["depclassloc"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_depclassloc" });
                STS_Json["department"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_department" });
                STS_Json["class"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_class" });
                STS_Json["location"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_location" });
                STS_Json["journalentry_form"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_journal" });
                STS_Json["creditmemo_form"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_creditmemo" });
                STS_Json["invoice_form"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_invoice" });

            }

            return STS_Json;

        } catch (e) {
            Library_Mail.sendemail('[ _getSetupTaxSubsidiary ]' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    return {
        setWHTLineTransaction: setWHTLineTransaction,
        deleteRelatedRecords: deleteRelatedRecords
    };

});
