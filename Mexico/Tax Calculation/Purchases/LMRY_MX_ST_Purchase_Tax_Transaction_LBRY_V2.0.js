/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_ST_Purchase_Tax_Transaction_LBRY_V2.0.js ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 01 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define([
    'N/log', 'N/record', 'N/search', 'N/runtime', 'N/ui/serverWidget',
    './LMRY_libSendingEmailsLBRY_V2.0',
    './LMRY_Log_LBRY_V2.0'
], function(log, record, search, runtime, serverWidget, Library_Mail, Library_Log) {

    var LMRY_SCRIPT = 'LMRY - MX ST Purchase Tax Transaction V2.0';
    var LMRY_SCRIPT_NAME = 'LMRY_MX_ST_Purchase_Tax_Transaction_LBRY_V2.0.js';

    // FEATURES
    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;

    /***************************************************************************
     * Funcion para que el campo Latam Col - Invoicing Idetifier se
     * deshabilite
     *      - scriptContext: Context del User Event
     ***************************************************************************/
    function disableInvoicingIdentifier(scriptContext) {

        try {

            var form = scriptContext.form;

            var Field_InvIdenti = form.getSublist({ id: 'item' }).getField({ id: 'custcol_lmry_invoicing_id' });
            Field_InvIdenti.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            var Field_InvIdenti = form.getSublist({ id: 'expense' }).getField({ id: 'custcol_lmry_invoicing_id' });
            Field_InvIdenti.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

        } catch (error) {
            Library_Mail.sendemail('[ beforeLoad - disableInvoicingIdentifier ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ beforeLoad - disableInvoicingIdentifier ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Funcion en donde se recuperan los impuestos de los Records Contributory
     *    Class o National Tax para posteriormente realizar los calculos de
     *    impuestos.
     ***************************************************************************/
    function setTaxTransaction(context) {

        try {

            var recordObj = context.newRecord;
            var actionType = context.type;

            var transactionID = recordObj.id;
            var transactionType = recordObj.type;

            if (['create', 'edit', 'copy'].indexOf(actionType) != -1) {

                var taxDetailOverride = recordObj.getValue({ fieldId: 'taxdetailsoverride' });
                if (taxDetailOverride == true || taxDetailOverride == 'T') {

                    deleteTaxDetailLines(recordObj);

                    FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: 'SUBSIDIARIES' });
                    FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: 'MULTIBOOK' });

                    var transactionSubsidiary = "";
                    if (FEATURE_SUBSIDIARY == true || FEATURE_MULTIBOOK == 'T') {
                        transactionSubsidiary = recordObj.getValue({ fieldId: 'subsidiary' });
                    } else {
                        transactionSubsidiary = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
                    }

                    var transactionCountry = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
                    var transactionDate = recordObj.getText({ fieldId: 'trandate' });
                    var tranDate = recordObj.getValue({ fieldId: 'trandate' });
                    var transactionEntity = recordObj.getValue({ fieldId: 'entity' });
                    var transactionDocType = recordObj.getValue({ fieldId: 'custbody_lmry_document_type' });

                    var filtroTransactionType = '';
                    switch (transactionType) {
                        case 'vendorbill':
                            filtroTransactionType = 4;
                            break;
                        case 'vendorcredit':
                            filtroTransactionType = 7;
                            break;
                    }

                    var STS_JSON = getSetupTaxSubsidiary(transactionSubsidiary);
                    var exchangeRate = getExchangeRate(recordObj, transactionSubsidiary, STS_JSON);
                    var CC_SearchResult = getContributoryClasses(transactionSubsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocType);
                    var NT_SearchResult = getNationalTaxes(transactionSubsidiary, transactionDate, filtroTransactionType, transactionDocType);

                    var itemLineCount = recordObj.getLineCount({ sublistId: 'item' });
                    var expenseLineCount = recordObj.getLineCount({ sublistId: 'expense' });

                    var lastDetailLine = 0;
                    var taxResult = [];

                    if (CC_SearchResult != null && CC_SearchResult.length > 0) {

                        for (var i = 0; i < CC_SearchResult.length; i++) {

                            var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
                            var CC_Memo = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_memo" });
                            var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
                            var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
                            var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
                            var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
                            var CC_STE_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_type" });
                            var CC_STE_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_type" });
                            var CC_STE_taxCode = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_code" });
                            var CC_STE_taxCodeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_code" });
                            var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
                            var CC_isExempt = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_isexempt" });
                            var CC_invIdent = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_invoice_identifier" });
                            var CC_invIdentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_invoice_identifier" });
                            var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
                            var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
                            var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
                            var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
                            var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
                            var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });

                            if (itemLineCount != null && itemLineCount > 0) {

                                for (var j = 0; j < itemLineCount; j++) {

                                    var item = recordObj.getSublistText({ sublistId: 'item', fieldId: 'item', line: j });
                                    var itemID = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                    var itemUniqueKey = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: j });
                                    var itemType = recordObj.getSublistValue({ sublistId: "item", fieldId: "itemtype", line: j });
                                    var itemInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                                    var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: j });

                                    if (itemInvoiceIdentifier == "" || itemInvoiceIdentifier == null) {
                                        continue;
                                    }

                                    if (itemType == "Group" || itemType == "EndGroup") {
                                        continue;
                                    }

                                    var II_JSON = getInvoicingIdentifierJSON(itemInvoiceIdentifier);

                                    var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0.0;

                                    if ((CC_invIdent == II_JSON.invoicing) && (CC_STE_taxType == II_JSON.taxtype) && (CC_STE_taxCode == II_JSON.taxcode)) {

                                        var itemTaxAmountByCC = parseFloat(itemNetAmount) * parseFloat(CC_taxRate);
                                        var itemGrossAmountByCC = parseFloat(itemNetAmount) + parseFloat(itemTaxAmountByCC);

                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(CC_taxRate) * 100 });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: itemTaxAmountByCC });

                                        taxResult.push({
                                            taxtype: {
                                                text: CC_taxType,
                                                value: CC_taxTypeID
                                            },
                                            ste_taxtype: {
                                                text: CC_STE_taxType,
                                                value: CC_STE_taxTypeID
                                            },
                                            ste_taxcode: {
                                                text: CC_STE_taxCode,
                                                value: CC_STE_taxCodeID
                                            },
                                            lineuniquekey: itemUniqueKey,
                                            baseamount: parseFloat(itemNetAmount),
                                            taxamount: Math.round(itemTaxAmountByCC * 100) / 100,
                                            taxrate: CC_taxRate,
                                            contributoryClass: CC_internalID,
                                            nationalTax: "",
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
                                            description: CC_Memo,
                                            lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                                            lc_taxamount: parseFloat(itemTaxAmountByCC * exchangeRate),
                                            lc_grossamount: parseFloat(itemGrossAmountByCC * exchangeRate)
                                        });

                                        lastDetailLine += 1;

                                    }

                                } // FIN FOR ITEM COUNT

                            } // FIN IF ITEM COUNT

                            if (expenseLineCount != null && expenseLineCount > 0) {

                                for (var j = 0; j < expenseLineCount; j++) {

                                    var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
                                    var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
                                    var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
                                    var expenseInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                                    var expenseDetailReference = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'taxdetailsreference', line: j });

                                    if (expenseInvoiceIdentifier == "" || expenseInvoiceIdentifier == null) {
                                        break;
                                    }

                                    var II_JSON = getInvoicingIdentifierJSON(expenseInvoiceIdentifier);

                                    var expenseNetAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0.0;

                                    if ((CC_invIdent == II_JSON.invoicing) && (CC_STE_taxType == II_JSON.taxtype) && (CC_STE_taxCode == II_JSON.taxcode)) {

                                        var expenseTaxAmountByCC = parseFloat(expenseNetAmount) * parseFloat(CC_taxRate);
                                        var expenseGrossAmountByCC = parseFloat(expenseNetAmount) + parseFloat(expenseTaxAmountByCC);

                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(CC_taxRate) * 100 });
                                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: expenseTaxAmountByCC });

                                        taxResult.push({
                                            taxtype: {
                                                text: CC_taxType,
                                                value: CC_taxTypeID
                                            },
                                            ste_taxtype: {
                                                text: CC_STE_taxType,
                                                value: CC_STE_taxTypeID
                                            },
                                            ste_taxcode: {
                                                text: CC_STE_taxCode,
                                                value: CC_STE_taxCodeID
                                            },
                                            lineuniquekey: expenseUniqueKey,
                                            baseamount: parseFloat(expenseNetAmount),
                                            taxamount: Math.round(expenseTaxAmountByCC * 100) / 100,
                                            taxrate: CC_taxRate,
                                            contributoryClass: CC_internalID,
                                            nationalTax: "",
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
                                            item: {},
                                            expenseacc: {
                                                text: account,
                                                value: accountID
                                            },
                                            position: j,
                                            description: CC_Memo,
                                            lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                                            lc_taxamount: parseFloat(expenseTaxAmountByCC * exchangeRate),
                                            lc_grossamount: parseFloat(expenseGrossAmountByCC * exchangeRate)
                                        });

                                        lastDetailLine += 1;

                                    }

                                } // FIN FOR EXPENSE COUNT

                            } // FIN IF EXPENSE COUNT

                        } // FIN FOR CONTRIBUTORY CLASS

                    } else { // FIN IF CONTRIBUTORY CLASS

                        if (NT_SearchResult != null && NT_SearchResult.length > 0) {

                            for (var i = 0; i < NT_SearchResult.length; i++) {

                                var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
                                var NT_Memo = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_memo" });
                                var NT_generatedTransaction = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
                                var NT_generatedTransactionID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
                                var NT_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_taxtype" });
                                var NT_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxtype" });
                                var NT_STE_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_ste_tax_type" });
                                var NT_STE_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_ste_tax_type" });
                                var NT_STE_taxCode = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_ste_tax_code" });
                                var NT_STE_taxCodeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_ste_tax_code" });
                                var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxrate" });
                                var NT_isExempt = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_isexempt" });
                                var NT_invIdent = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_invoicing_identifier" });
                                var NT_invIdentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_invoicing_identifier" });
                                var NT_Department = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_department" });
                                var NT_DepartmentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_department" });
                                var NT_Class = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_class" });
                                var NT_ClassID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_class" });
                                var NT_Location = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_location" });
                                var NT_LocationID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_location" });

                                if (itemLineCount != null && itemLineCount > 0) {

                                    for (var j = 0; j < itemLineCount; j++) {

                                        var item = recordObj.getSublistText({ sublistId: 'item', fieldId: 'item', line: j });
                                        var itemID = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                        var itemUniqueKey = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: j });
                                        var itemInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                                        var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: j });

                                        if (itemInvoiceIdentifier == "" || itemInvoiceIdentifier == null) {
                                            break;
                                        }

                                        var II_JSON = getInvoicingIdentifierJSON(itemInvoiceIdentifier);

                                        var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0.0;

                                        if ((NT_invIdent == II_JSON.invoicing) && (NT_STE_taxType == II_JSON.taxtype) && (NT_STE_taxCode == II_JSON.taxcode)) {

                                            var itemTaxAmountByNT = parseFloat(itemNetAmount) * parseFloat(NT_taxRate);
                                            var itemGrossAmountByNT = parseFloat(itemNetAmount) + parseFloat(itemTaxAmountByNT);

                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(NT_taxRate) * 100 });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: itemTaxAmountByNT });

                                            taxResult.push({
                                                taxtype: {
                                                    text: NT_taxType,
                                                    value: NT_taxTypeID
                                                },
                                                ste_taxtype: {
                                                    text: NT_STE_taxType,
                                                    value: NT_STE_taxTypeID
                                                },
                                                ste_taxcode: {
                                                    text: NT_STE_taxCode,
                                                    value: NT_STE_taxCodeID
                                                },
                                                lineuniquekey: itemUniqueKey,
                                                baseamount: parseFloat(itemNetAmount),
                                                taxamount: Math.round(itemTaxAmountByNT * 100) / 100,
                                                taxrate: NT_taxRate,
                                                contributoryClass: "",
                                                nationalTax: NT_internalID,
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
                                                position: i,
                                                description: NT_Memo,
                                                lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                                                lc_taxamount: parseFloat(itemTaxAmountByNT * exchangeRate),
                                                lc_grossamount: parseFloat(itemGrossAmountByNT * exchangeRate)
                                            });

                                            lastDetailLine += 1;

                                        }

                                    } // FIN FOR ITEM COUNT

                                } // FIN IF ITEM COUNT

                                if (expenseLineCount != null && expenseLineCount > 0) {

                                    for (var j = 0; j < expenseLineCount; j++) {

                                        var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
                                        var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
                                        var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
                                        var expenseInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                                        var expenseDetailReference = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'taxdetailsreference', line: j });

                                        if (expenseInvoiceIdentifier == "" || expenseInvoiceIdentifier == null) {
                                            break;
                                        }

                                        var II_JSON = getInvoicingIdentifierJSON(expenseInvoiceIdentifier);

                                        var expenseNetAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0.0;

                                        if ((NT_invIdent == II_JSON.invoicing) && (NT_STE_taxType == II_JSON.taxtype) && (NT_STE_taxCode == II_JSON.taxcode)) {

                                            var expenseTaxAmountByNT = parseFloat(expenseNetAmount) * parseFloat(NT_taxRate);
                                            var expenseGrossAmountByNT = parseFloat(expenseNetAmount) + parseFloat(expenseTaxAmountByNT);

                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(NT_taxRate) * 100 });
                                            recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: expenseTaxAmountByNT });

                                            taxResult.push({
                                                taxtype: {
                                                    text: NT_taxType,
                                                    value: NT_taxTypeID
                                                },
                                                ste_taxtype: {
                                                    text: NT_STE_taxType,
                                                    value: NT_STE_taxTypeID
                                                },
                                                ste_taxcode: {
                                                    text: NT_STE_taxCode,
                                                    value: NT_STE_taxCodeID
                                                },
                                                lineuniquekey: expenseUniqueKey,
                                                baseamount: parseFloat(expenseNetAmount),
                                                taxamount: Math.round(expenseTaxAmountByNT * 100) / 100,
                                                taxrate: NT_taxRate,
                                                contributoryClass: "",
                                                nationalTax: NT_internalID,
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
                                                item: {},
                                                expenseacc: {
                                                    text: account,
                                                    value: accountID
                                                },
                                                position: i,
                                                description: NT_Memo,
                                                lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                                                lc_taxamount: parseFloat(expenseTaxAmountByNT * exchangeRate),
                                                lc_grossamount: parseFloat(expenseGrossAmountByNT * exchangeRate)
                                            });

                                            lastDetailLine += 1;

                                        }

                                    } // FIN FOR EXPENSE COUNT

                                } // FIN IF EXPENSE COUNT

                            } // FIN FOR NATIONAL TAX

                        } // FIN IF NATIONAL TAX

                    }

                    saveTaxResult(transactionID, transactionSubsidiary, transactionCountry, tranDate, taxResult);

                } // FIN IF TAX DETAIL OVERRIDE

            }

            return recordObj;

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - setTaxTransaction ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - setTaxTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * GUARDAR UN REGISTRO EN EL RECORD: LATMAREADY - LATAMTAX TAX RESULT
     *    - recordID: ID de la transacci??n
     *    - subsidiary: ID de la subsidiaria
     *    - countryID: ID del pa??s
     *    - tranDate: Fecha de la transaccion
     *    - taxResult: Arreglo de JSON con los detalles de impuestos
     ***************************************************************************/
    function saveTaxResult(recordID, subsidiary, countryID, tranDate, taxResult) {

        try {

            var taxResultSearch = search.create({
                type: "customrecord_lmry_ste_json_result",
                columns: ["internalid"],
                filters: [
                    ["custrecord_lmry_ste_related_transaction", "IS", recordID]
                ]
            }).run().getRange(0, 10);

            if (taxResultSearch !== null && taxResultSearch.length > 0) {

                var taxResultID = taxResultSearch[0].getValue({ name: "internalid" });

                record.submitFields({
                    type: "customrecord_lmry_ste_json_result",
                    id: taxResultID,
                    values: {
                        "custrecord_lmry_ste_subsidiary": subsidiary,
                        "custrecord_lmry_ste_subsidiary_country": countryID,
                        "custrecord_lmry_ste_transaction_date": tranDate,
                        "custrecord_lmry_ste_tax_transaction": JSON.stringify(taxResult)
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

            } else {

                var TR_Record = record.create({
                    type: "customrecord_lmry_ste_json_result",
                    isDynamic: false
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_ste_related_transaction",
                    value: recordID
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_ste_subsidiary",
                    value: subsidiary
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_ste_subsidiary_country",
                    value: countryID
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_ste_transaction_date",
                    value: tranDate
                });
                TR_Record.setValue({
                    fieldId: "custrecord_lmry_ste_tax_transaction",
                    value: JSON.stringify(taxResult)
                });

                var recordSave = TR_Record.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

            }

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - saveTaxResult ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ adterSubmit - saveTaxResult ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - NATIONAL TAX
     *    - subsidiary: Subsiaria
     *    - transactionDate: Fecha de creaci??n de la transacci??n
     *    - filtroTransactionType: Invoice / Credit Memo
     *    - entity: ID de la Entidad
     *    - documentType: Tipo de Documento Fiscal
     ***************************************************************************/
    function getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, documentType) {

        try {

            var NT_Columns = [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_memo', label: 'Latam - Memo' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_gen_transaction', label: 'Latam - Generated Transacation?' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_taxtype', label: 'Latam - Tax Type' }),
                search.createColumn({ name: 'custrecord_lmry_nt_ste_tax_type', label: 'Latam - STE Tax Type' }),
                search.createColumn({ name: 'custrecord_lmry_nt_ste_tax_code', label: 'Latam - STE Tax Code' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_appliesto', label: 'Latam - Applies To' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_taxrate', label: 'Latam - Tax Rate'?? }),
                search.createColumn({ name: 'custrecord_lmry_ntax_isexempt', label: 'Latam - Is Exempt?' }),
                search.createColumn({ name: 'custrecord_lmry_nt_invoicing_identifier', label: 'Latam - Invoicing Identifier' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_department', label: 'Latam - Department' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_class', label: 'Latam - Class' }),
                search.createColumn({ name: 'custrecord_lmry_ntax_location', label: 'Latam - Location' })
            ];

            var NT_Filters = [
                search.createFilter({ name: 'isinactive', operator: 'IS', values: ['F'] }),
                search.createFilter({ name: 'custrecord_lmry_ntax_datefrom', operator: 'ONORBEFORE', values: transactionDate }),
                search.createFilter({ name: 'custrecord_lmry_ntax_dateto', operator: 'ONORAFTER', values: transactionDate }),
                search.createFilter({ name: 'custrecord_lmry_ntax_transactiontypes', operator: 'ANYOF', values: filtroTransactionType?? }),
                search.createFilter({ name: 'custrecord_lmry_ntax_appliesto', operator: 'ANYOF', values: ["2"] }),
                search.createFilter({ name: 'custrecord_lmry_ntax_taxtype', operator: 'ANYOF', values: ["4"] }), // 1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
                search.createFilter({ name: 'custrecord_lmry_ntax_gen_transaction', operator: 'ANYOF', values: ["3"] }) // 1:Journal, 2:SuiteGl, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, LatamTax (Sales)
            ];

            var documents = ["@NONE@"];
            if (documentType) {
                documents.push(documentType);
            }
            NT_Filters.push(search.createFilter({ name: 'custrecord_lmry_ntax_fiscal_doctype', operator: 'ANYOF', values: documents }));

            if (FEATURE_SUBSIDIARY === true || ??FEATURE_SUBSIDIARY === "T") {
                NT_Filters.push(search.createFilter({ name: 'custrecord_lmry_ntax_subsidiary', operator: 'ANYOF', values: subsidiary }));
            }

            var searchNT = search.create({
                type: "customrecord_lmry_national_taxes",
                columns: NT_Columns,
                filters: NT_Filters
            }).run().getRange(0, 1000);

            return searchNT;

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - getNationalTaxes ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - getNationalTaxes ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
     *    - subsidiary: Subsiaria
     *    - transactionDate: Fecha de creaci??n de la transacci??n
     *    - filtroTransactionType: Invoice / Credit Memo
     *    - entity: ID de la Entidad
     *    - documentType: Tipo de Documento Fiscal
     ***************************************************************************/
    function getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, entity, documentType) {

        try {

            var CC_Columns = [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_memo', label: 'Latam - Memo' }),
                search.createColumn({ name: 'custrecord_lmry_ccl_gen_transaction', label: 'Latam - Generated Transacation?' }),
                search.createColumn({ name: 'custrecord_lmry_ccl_taxtype', label: 'Latam - Tax Type' }),
                search.createColumn({ name: 'custrecord_lmry_cc_ste_tax_type', label: 'Latam - STE Tax Type' }),
                search.createColumn({ name: 'custrecord_lmry_cc_ste_tax_code', label: 'Latam - STE Tax Code' }),
                search.createColumn({ name: 'custrecord_lmry_ccl_appliesto', label: 'Latam - Applies To' }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_taxrate', label: 'Latam - Tax Rate'?? }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_isexempt', label: 'Latam - Is Exempt?' }),
                search.createColumn({ name: 'custrecord_lmry_cc_invoice_identifier', label: 'Latam - Invoicing Identifier' }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_department', label: 'Latam - Department' }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_class', label: 'Latam - Class' }),
                search.createColumn({ name: 'custrecord_lmry_ar_ccl_location', label: 'Latam - Location' })
            ];

            var CC_Filters = [
                search.createFilter({ name: 'isinactive', operator: 'IS', values: ['F'] }),
                search.createFilter({ name: 'custrecord_lmry_ar_ccl_fechdesd', operator: 'ONORBEFORE', values: transactionDate }),
                search.createFilter({ name: 'custrecord_lmry_ar_ccl_fechhast', operator: 'ONORAFTER', values: transactionDate }),
                search.createFilter({ name: 'custrecord_lmry_ccl_transactiontypes', operator: 'ANYOF', values: filtroTransactionType?? }),
                search.createFilter({ name: 'custrecord_lmry_ar_ccl_entity', operator: 'ANYOF', values: entity }),
                search.createFilter({ name: 'custrecord_lmry_ccl_appliesto', operator: 'ANYOF', values: ["2"] }),
                search.createFilter({ name: 'custrecord_lmry_ccl_taxtype', operator: 'ANYOF', values: ["4"] }), // 1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
                search.createFilter({ name: 'custrecord_lmry_ccl_gen_transaction', operator: 'ANYOF', values: ["3"] }) // 1:Journal, 2:SuiteGl, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, LatamTax (Sales)
            ];

            var documents = ["@NONE@"];
            if (documentType) {
                documents.push(documentType);
            }
            CC_Filters.push({ name: 'custrecord_lmry_ccl_fiscal_doctype', operator: 'ANYOF', values: documents?? });

            if (FEATURE_SUBSIDIARY === true || ??FEATURE_SUBSIDIARY === "T") {
                CC_Filters.push({ name: 'custrecord_lmry_ar_ccl_subsidiary', operator: 'ANYOF', values: subsidiary });
            }

            var searchCC = search.create({
                type: "customrecord_lmry_ar_contrib_class",
                columns: CC_Columns,
                filters: CC_Filters
            }).run().getRange(0, 1000);

            return searchCC;

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - getContributoryClasses ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - getContributoryClasses ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * FUNCION PARA OBTENER EL TIPO DE CAMBIO CON EL QUE SE VAN A REALIZAR LOS
     * CALLCULOS DE IMPUESTOS
     *    - recordObj: Registro de la transaccion
     *    - subsidiary: Subsidiaria de transaccion
     *    - STS_JSON: Json con campos del record LatamReady - Setup Tax Subsidiary
     ***************************************************************************/
    function getExchangeRate(recordObj, subsidiary, STS_JSON) {

        try {

            var transactionExchangeRate = recordObj.getValue({ fieldId: "exchangerate" });

            var exchangeRate = 1;
            if ((FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") && (FEATURE_MULTIBOOK === true || FEATURE_MULTIBOOK === "T")) {

                var subsiadiarySearch = search.lookupFields({
                    type: "subsidiary",
                    id: subsidiary,
                    columns: ["currency"]
                });

                var subsidiaryCurrency = subsiadiarySearch.currency[0].value;
                if ((subsidiaryCurrency !== STS_JSON.currency) && (STS_JSON.currency !== "" && STS_JSON.currency != null)) {

                    var bookLineCount = recordObj.getLineCount({ sublistId: "accountingbookdetail" });
                    if (bookLineCount !== "" && bookLineCount !== null) {

                        for (var i = 0; i < bookLineCount; i++) {

                            var bookCurrency = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "currency", line: i });
                            if (bookCurrency === STS_JSON.currency) {
                                exchangerate = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "exchangerate", line: i });
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

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - getExchangeRate ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - getExchangeRate ]', message: error, relatedScript: LMRY_SCRIPT_NAME });

        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY
     *    - subsidiary: Subsiaria a filtrar para recuperar su configuraci??n
     ***************************************************************************/
    function getSetupTaxSubsidiary(subsidiary) {

        try {

            var STS_Columns = [
                search.createColumn({ name: 'custrecord_lmry_setuptax_subsidiary', label: 'Latam - Subsidiary' }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_currency', label: 'Latam - Currency' }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_depclassloc', label: 'Latam - Department, Class & Location' }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_department', label: 'Latam - Department'?? }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_class', label: 'Latam - Class' }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_location', label: 'Latam - Location'?? }),
                search.createColumn({ name: 'taxtype', join: 'custrecord_lmry_setuptax_tax_code', label: 'Latam - Tax Type' }),
                search.createColumn({ name: 'custrecord_lmry_setuptax_tax_code', label: 'Latam - Tax Code' })
            ];

            var STS_Filters = [
                ["isinactive", "IS", "F"], "AND"
            ];

            if (FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") {
                STS_Filters.push(["custrecord_lmry_setuptax_subsidiary", "ANYOF", subsidiary]);
            }

            var setupTaxSubsidiarySearch = search.create({
                type: "customrecord_lmry_setup_tax_subsidiary",
                columns: STS_Columns,
                filters: STS_Filters
            }).run().getRange(0, 10);

            var setupTaxSubsidiary = {};
            if (setupTaxSubsidiarySearch && setupTaxSubsidiarySearch.length > 0) {

                var columns = setupTaxSubsidiarySearch[0].columns;
                setupTaxSubsidiary["subsidiary"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_subsidiary" });
                setupTaxSubsidiary["currency"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_currency" });
                setupTaxSubsidiary["depclassloc"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_depclassloc" });
                setupTaxSubsidiary["department"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_department" });
                setupTaxSubsidiary["class"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_class" });
                setupTaxSubsidiary["location"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_location" });
                setupTaxSubsidiary["taxtype"] = setupTaxSubsidiarySearch[0].getValue(setupTaxSubsidiarySearch[0].columns[6]);
                setupTaxSubsidiary["taxcode"] = setupTaxSubsidiarySearch[0].getValue({ name: "custrecord_lmry_setuptax_tax_code" });

            }

            return setupTaxSubsidiary;

        } catch (error) {
            Library_Mail.sendemail('[ afterSubmit - getSetupTaxSubsidiary ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - getSetupTaxSubsidiary ] ', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY
     *    - subsidiary: Subsiaria a filtrar para recuperar su configuraci??n
     ***************************************************************************/
     function getInvoicingIdentifierJSON(invoicingIdentifier) {

         try {
             var aux1 = invoicingIdentifier.split(":");
             var aux2 = aux1[1].split(" ");
             // FORMATO ORIGINAL: AT_CO:CO_SR (Exportacion - Gravado - Reducido)
             // FORMATO NUEVO:
             // AT_CO
             // CO_SR
             // Exportacion - Gravado - Reducido
             // Expresion regular para obtener lo que esta dentro de los parentesis
             var regExp = /\(([^)]+)\)/;
             var aux3 = regExp.exec(aux1[1]);
             var aux4 = aux1[1];
             var II_JSON = {
                 taxtype: aux1[0],
                 taxcode: aux2[0],
                 invoicing: aux3[1],
             };

             return II_JSON;

         } catch (error) {
             Library_Mail.sendemail( "[ afterSubmit - getInvoicingIdentifierJSON ]: " + error, LMRY_SCRIPT );
             Library_Log.doLog({ title: "[ afterSubmit - getInvoicingIdentifierJSON ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
         }

     }

    /***************************************************************************
     * FUNCTION PARA PARA ELIMINAR LAS LINEAS DE LA TRANSACCION NUEVA CUANDO SE
     * HACE UN MAKE COPY
     *    - recordObj: Transaccion
     ***************************************************************************/
    function deleteTaxDetailLines(recordObj) {

        try {

            var taxDetailLines = recordObj.getLineCount({ sublistId: "taxdetails" });
            if (taxDetailLines != null && taxDetailLines > 0) {
                for (var i = taxDetailLines - 1; i >= 0; i--) {
                    recordObj.removeLine({ sublistId: "taxdetails", line: i });
                }
            }

        } catch (error) {
            Library_Mail.sendemail('[ beforeLoad - deleteTaxDetailLines ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ beforeLoad - deleteTaxDetailLines ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * FUNCTION PARA ELIMINAR EL TAX RESULT RELACIONADO A LA TRANSACCION
     * DESPUES DE QUE ESTA HAYA SIDO ELIMINADA
     *    - recordObj: Transaccion
     ***************************************************************************/
    function deleteTaxResult(recordObjID) {

        try {

            var taxResultSeach = search.create({
                type: "customrecord_lmry_ste_json_result",
                columns: ["internalid"],
                filters: [
                    ["custrecord_lmry_ste_related_transaction", "IS", recordObjID]
                ]
            }).run().getRange(0, 10);

            if (taxResultSeach != null && taxResultSeach.length > 0) {

                var taxResultID = taxResultSeach[0].getValue({ name: "internalid" });
                record.delete({
                    type: "customrecord_lmry_ste_json_result",
                    id: taxResultID
                });

            }

        } catch (error) {
            Library_Mail.sendemail('[ beforeSubmit - deleteTaxResult ]: ' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ beforeSubmit - deleteTaxResult ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    return {
        disableInvoicingIdentifier: disableInvoicingIdentifier,
        setTaxTransaction: setTaxTransaction,
        deleteTaxDetailLines: deleteTaxDetailLines,
        deleteTaxResult: deleteTaxResult
    };

});
