/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for Transaction Credit Memo                    ||
||                                                              ||
||  File Name: LMRY_CreditMemoURET_V2.0.js                      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 20 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */


define(['N/currency', 'N/log', 'N/config', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/runtime',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_HideViewLBRY_V2.0', './Latam_Library/LMRY_libWhtValidationLBRY_V2.0',
    './Latam_Library/LMRY_libNumberInWordsLBRY_V2.0', './Latam_Library/LMRY_libRedirectAccountsLBRY_V2.0',
    './WTH_Library/LMRY_TAX_TransactionLBRY_V2.0', './WTH_Library/LMRY_AutoPercepcionDesc_LBRY_V2.0', './Latam_Library/LMRY_GLImpact_LBRY_V2.0',
    './WTH_Library/LMRY_Country_WHT_Lines_LBRY_V2.0', './Latam_Library/LMRY_HideView3LBRY_V2.0', './Latam_Library/LMRY_ExchangeRate_LBRY_V2.0',
    './Latam_Library/LMRY_UniversalSetting_LBRY', './WTH_Library/LMRY_TAX_Withholding_LBRY_V2.0', './WTH_Library/LMRY_ST_Tax_TransactionLBRY_V2.0',
    './WTH_Library/LMRY_ST_Tax_Withholding_LBRY_V2.0', './Latam_Library/LMRY_CL_ST_Transaction_Sales_LBRY_V2.0', './WTH_Library/LMRY_EC_BaseAmounts_TaxCode_LBRY',
    './Latam_Library/LMRY_BR_ValidateDuplicate_LBRY_V2.0', './Latam_Library/LMRY_CO_Duplicate_Credit_Memos_LBRY_V2.0',
    './Latam_Library/LMRY_MX_ST_Sales_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_CO_ST_Sales_Tax_Transaction_LBRY_V2.0',
    './Latam_Library/LMRY_PE_MapAndSaveFields_LBRY_v2.0', './Latam_Library/LMRY_CO_ST_CreditMemo_WHT_Lines_LBRY_2.0',
    './Latam_Library/LMRY_SV_ST_Sales_Tax_Transaction_LBRY_V2.0',
],

    function (currency, log, config, serverWidget, record, search, runtime, libraryMail, library_HideView, libraryValidation, libraryNumber,
        libraryRedirect, Library_WHT_Transaction, Library_AutoPercepcionDesc, libraryGLImpact, libWHTLines, library_hideview3, library_ExchRate, library_Uni_Setting, Library_Tax_WHT,
        ST_TAX_Transaction, ST_WHT_Transaction, ST_Library_Transaction_CL, libraryEcBaseAmounts, Library_BRDup, Library_Duplicate,
        MX_ST_TaxLibrary, CO_ST_TaxLibrary, PE_libMapTransactions, CO_ST_WhtLibrary_Lines, SV_ST_TaxLibrary) {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        var LMRY_script = "LatamReady - Credit Memo URET V2.0";
        var recordObj = '';
        var isUret = true;
        var form = '';
        var licenses = [];
        var statusError = false;

        // SuiteTax
        var ST_FEATURE = false;

        function beforeLoad(scriptContext) {

            try {

                // SuiteTax
                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                recordObj = scriptContext.newRecord;
                var type = scriptContext.type;
                form = scriptContext.form;
                typeC = recordObj.type;

                // Obtiene la interface que se esta ejecutando
                var type_interface = runtime.executionContext;

                // Sale del proceso si es MAPREDUCE
                /*if (['USERINTERFACE', "CSVIMPORT"].indexOf(type_interface) == -1) {
                  return true;
                }*/

                var LMRY_countr = new Array();
                var country = new Array();
                country[0] = '';
                country[1] = '';

                /* Carga las licencias de todos los paises */
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = libraryMail.getLicenses(subsidiary);
                if (licenses == null || licenses == '') {
                    licenses = [];
                    library_hideview3.PxHide(form, '', typeC);
                    library_hideview3.PxHideSubTab(form, '', typeC);
                    library_hideview3.PxHideColumn(form, '', typeC);
                }

                if (scriptContext.type == 'create') {

                    var companyInformation = config.load({
                        type: config.Type.COMPANY_INFORMATION
                    });

                    var baseCurrency = companyInformation.getValue({
                        fieldId: 'basecurrency'
                    });

                    var lmry_basecurrency = form.addField({
                        id: 'custpage_lmry_basecurrency',
                        label: 'Latam - Base Currency',
                        type: serverWidget.FieldType.TEXT
                    }).defaultValue = baseCurrency;

                    var lmry_exchange_rate = form.addField({
                        id: 'custpage_lmry_exchange_rate',
                        label: 'Latam - Exchange Rate',
                        type: serverWidget.FieldType.SELECT
                    });

                    form.insertField({
                        field: lmry_exchange_rate,
                        nextfield: 'currency'
                    });
                }


                if (type != 'print' && type != 'email') {
                    try {
                        var subsidiari = recordObj.getValue({
                            fieldId: 'subsidiary'
                        });
                        if (subsidiari == '' || subsidiari == null) {
                            var userS = runtime.getCurrentUser();
                            subsidiari = userS.subsidiary;
                        }
                        if (subsidiari != '' && subsidiari != null) {
                            var filters = new Array();
                            filters[0] = search.createFilter({
                                name: 'internalid',
                                operator: search.Operator.ANYOF,
                                values: [subsidiari]
                            });
                            var columns = new Array();
                            columns[0] = search.createColumn({
                                name: 'country'
                            });

                            var getfields = search.create({
                                type: 'subsidiary',
                                columns: columns,
                                filters: filters
                            });
                            getfields = getfields.run().getRange(0, 1000);

                            if (getfields != '' && getfields != null) {
                                country[0] = getfields[0].getValue('country');
                                country[1] = getfields[0].getText('country');
                            }
                        }
                    } catch (err) {
                        country[0] = runtime.getCurrentScript().getParameter({
                            name: 'custscript_lmry_country_code_stlt'
                        });
                        country[1] = runtime.getCurrentScript().getParameter({
                            name: 'custscript_lmry_country_desc_stlt'
                        });

                    }

                    if (form != '' && form != null) {
                        //Se obtiene el feature de General Preferencpara saber si se debe de ocultar
                        //Las columnas, los Cust Bodys y las Sublist.
                        var hide_transaction = libraryMail.getHideView(country, 2, licenses);
                        var hide_sublist = libraryMail.getHideView(country, 5, licenses);
                        var hide_column = libraryMail.getHideView(country, 3, licenses);

                        if (libraryMail.getCountryOfAccess(country, licenses)) {
                            if (hide_column == true) {
                                //Oculta los campos Column
                                library_hideview3.PxHideColumn(form, country[0], typeC);
                            }

                            if (hide_sublist == true) {
                                //Oculta los campos Cust Record
                                library_hideview3.PxHideSubTab(form, country[0], typeC);
                            }

                            if (hide_transaction == true) {
                                //Oculta los campos Body
                                library_hideview3.PxHide(form, country[0], typeC);
                            }
                        } else {
                            if (hide_column == true) {
                                //Oculta los campos Column
                                library_hideview3.PxHideColumn(form, '', typeC);
                            }

                            if (hide_sublist == true) {
                                //Oculta los campos Record
                                library_hideview3.PxHideSubTab(form, '', typeC);
                            }

                            if (hide_transaction == true) {
                                //Oculta los campos Body
                                library_hideview3.PxHide(form, '', typeC);
                            }
                        }

                    }
                }

                /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                 * Fecha : 21 de abril de 2020
                 * Se agrego que todas las validacion de localizacion
                 * esten dentro de la condicional :
                 *    if (type != 'print' && type != 'email')
                 * * * * * * * * * * * * * * * * * * * * * * * * * * */
                if (type != 'print' && type != 'email') {
                    //Se crea custpage para controlar el seteo automatico en el record anexado
                    if (scriptContext.type == 'create') {
                        form.addField({
                            id: 'custpage_uni_set_status',
                            label: 'Set Estatus',
                            type: serverWidget.FieldType.CHECKBOX
                        }).defaultValue = 'F';
                    }

                    var featuresubs = runtime.isFeatureInEffect({
                        feature: 'SUBSIDIARIES'
                    });
                    if (featuresubs == true || featuresubs == 'T') {
                        var subsidiary = recordObj.getValue({
                            fieldId: 'subsidiary'
                        });
                        var LMRY_Result = Validate_Access_CM(subsidiary, form, typeC, type, recordObj);
                    } else {
                        var LMRY_Result = Validate_Access_CM(1, form, typeC, type, recordObj);
                    }

                    if (LMRY_Result[0] == 'BR') {
                        if (type == 'create') {
                            var numLines = recordObj.getLineCount({
                                sublistId: 'item'
                            });

                            var hasCatalog = false;

                            for (var i = 0; i < numLines; i++) {
                                var catalog = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_br_service_catalog',
                                    line: i
                                });
                                if (catalog) {
                                    hasCatalog = true;
                                    break;
                                }
                            }

                            if (hasCatalog) {
                                var createdFrom = recordObj.getValue({
                                    fieldId: 'createdfrom',
                                });

                                //Si se crea una transaccion desde otra, se limpian los valores para calculo de impuesto BR.
                                if (createdFrom) {
                                    if (ST_FEATURE == true || ST_FEATURE == "T") {
                                        ST_TAX_Transaction.cleanLinesforCopy(recordObj, licenses);
                                    } else {
                                        Library_WHT_Transaction.cleanLinesforCopy(recordObj, licenses);
                                    }
                                }
                            }

                        }
                    }

                    // LatamTax - SuiteTax
                    if (ST_FEATURE == true || ST_FEATURE == "T") {

                        if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {
                            switch (LMRY_Result[0]) {
                                case "MX":
                                    MX_ST_TaxLibrary.disableInvoicingIdentifier(scriptContext);
                                    break;
                                case "CO":
                                    CO_ST_TaxLibrary.disableInvoicingIdentifier(scriptContext);
                                    break;
                                case "SV":
                                    SV_ST_TaxLibrary.disableInvoicingIdentifier(scriptContext);
                                    break;
                            }
                        }

                        if (["copy", "xcopy"].indexOf(scriptContext.type) != -1) {
                            switch (LMRY_Result[0]) {
                                case "CL":
                                    ST_Library_Transaction_CL.cleanLinesforCopy(recordObj, licenses);
                                    break;
                                case "MX":
                                    MX_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                    break;
                                case "CO":
                                    CO_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                    break;
                                case "SV":
                                    SV_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                    break;
                            }
                        }

                        if (["copy", "create"].indexOf(scriptContext.type) != -1) {
                            var createdFrom = recordObj.getValue({ fieldId: "createdfrom" });
                            if (createdFrom) {
                                switch (LMRY_Result[0]) {
                                    case "CL":
                                        ST_Library_Transaction_CL.cleanLinesforCopy(recordObj, licenses);
                                        break;
                                    case "MX":
                                        MX_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                        break;
                                    case "CO":
                                        CO_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                        break;
                                    case "SV":
                                        SV_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                        break;
                                }
                            }
                        }

                    }

                    if (LMRY_Result[0] == 'CO') {
                        if (libraryMail.getAuthorization(340, licenses) || libraryMail.getAuthorization(721, licenses)) {
                            var formObj = scriptContext.form;
                            var reteica = formObj.getField('custbody_lmry_co_reteica');
                            var reteiva = formObj.getField('custbody_lmry_co_reteiva');
                            var retefte = formObj.getField('custbody_lmry_co_retefte');
                            var retecree = formObj.getField('custbody_lmry_co_autoretecree');
                            reteica.updateDisplayType({
                                displayType: 'hidden'
                            });
                            reteiva.updateDisplayType({
                                displayType: 'hidden'
                            });
                            retefte.updateDisplayType({
                                displayType: 'hidden'
                            });
                            retecree.updateDisplayType({
                                displayType: 'hidden'
                            });
                        }
                    }

                    if (LMRY_Result[0] == 'CL') {
                        if (type == 'create') {
                            var numLines = recordObj.getLineCount({
                                sublistId: 'item'
                            });

                            var createdFrom = recordObj.getValue({
                                fieldId: 'createdfrom',
                            });

                            //Si se crea una transaccion desde otra, se limpian los valores para calculo de impuesto CL.
                            if (createdFrom) {
                                if (ST_FEATURE == true || ST_FEATURE == "T") {
                                    ST_Library_Transaction_CL.cleanLinesforCopy(recordObj, licenses);
                                }
                            }
                        }
                        if (libraryMail.getAuthorization(414, licenses)) {
                            var fieldSerie = form.getField({
                                id: 'custbody_lmry_serie_doc_cxc'
                            });

                            if (fieldSerie) {
                                fieldSerie.updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.NORMAL
                                });
                            }
                        }
                    }



                    if (LMRY_Result[0] == 'PE') {
                        if (libraryMail.getAuthorization(568, licenses)) {
                            var createdFrom = recordObj.getValue({
                                fieldId: 'createdfrom'
                            });

                            // Transacion relaciona de forma standar
                            if (createdFrom != null && createdFrom != '') {
                                var invoiceData = search.lookupFields({
                                    type: 'invoice',
                                    id: createdFrom,
                                    columns: ['custbody_lmry_concepto_detraccion', 'custbody_lmry_porcentaje_detraccion']
                                });
                                if (invoiceData.custbody_lmry_concepto_detraccion != null && invoiceData.custbody_lmry_concepto_detraccion != '') {
                                    recordObj.setValue({
                                        fieldId: 'custbody_lmry_concepto_detraccion',
                                        value: invoiceData.custbody_lmry_concepto_detraccion[0].value
                                    });
                                }
                                if (invoiceData.custbody_lmry_porcentaje_detraccion) {
                                    recordObj.setValue({
                                        fieldId: 'custbody_lmry_porcentaje_detraccion',
                                        value: invoiceData.custbody_lmry_porcentaje_detraccion
                                    });
                                }

                                /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                                 * Fecha : 18 de Agosto de 2021
                                 * Se agrego asociar la transaccion origen con el CM
                                 *    Latam - Transaction Reference
                                 *    Latam - Transaction Reference ID
                                 * * * * * * * * * * * * * * * * * * * * * * * * * * */
                                recordObj.setValue({
                                    fieldId: 'custbody_lmry_reference_transaction',
                                    value: createdFrom
                                });
                                recordObj.setValue({
                                    fieldId: 'custbody_lmry_reference_transaction_id',
                                    value: createdFrom
                                });
                            } // Transacion relaciona de forma standar

                        }

                    }

                    // Lógica GL Impact
                    if (type == 'view') {
                        // Obtiene el idioma del entorno
                        var featurelang = runtime.getCurrentScript().getParameter({
                            name: 'LANGUAGE'
                        });
                        featurelang = featurelang.substring(0, 2);

                        var formulario = scriptContext.form;

                        var btnGl = libraryGLImpact.featureGLImpact(recordObj, 'creditmemo');
                        if (btnGl == 1) {
                            if (featurelang == 'es') {
                                form.addButton({
                                    id: 'custpage_id_button_imp',
                                    label: 'IMPRIMIR GL',
                                    functionName: 'onclick_event_gl_impact()'
                                });
                            } else {
                                form.addButton({
                                    id: 'custpage_id_button_imp',
                                    label: 'PRINT GL',
                                    functionName: 'onclick_event_gl_impact()'
                                });
                            }
                            form.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
                        }

                        // CO - Print withholdings in GL Impact	(09.11.2020)
                        if (libraryMail.getAuthorization(552, licenses)) {
                            var whtamount = parseFloat(recordObj.getValue({
                                fieldId: 'custbody_lmry_co_reteica_amount'
                            })) +
                                parseFloat(recordObj.getValue({
                                    fieldId: 'custbody_lmry_co_reteiva_amount'
                                })) +
                                parseFloat(recordObj.getValue({
                                    fieldId: 'custbody_lmry_co_retefte_amount'
                                })) +
                                parseFloat(recordObj.getValue({
                                    fieldId: 'custbody_lmry_co_retecree_amount'
                                }));
                            if (whtamount > 0) {
                                if (featurelang == 'es') {
                                    form.addButton({
                                        id: 'custpage_id_button_imp',
                                        label: 'CO-IMPRIMIR GL WHT',
                                        functionName: 'onclick_event_co_wht_gl_impact()'
                                    });
                                } else {
                                    form.addButton({
                                        id: 'custpage_id_button_imp',
                                        label: 'CO-PRINT GL WHT',
                                        functionName: 'onclick_event_co_wht_gl_impact()'
                                    });
                                }
                                form.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
                            }
                        }
                    } // Fin Lógica GL Impact

                    /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                     * Fecha : 21 de abril de 2020
                     * Se agrego que todas las validacion sean dentro
                     * de la condicional :
                     *    if (scriptContext.type == 'create')
                     * * * * * * * * * * * * * * * * * * * * * * * * * * */
                    if (scriptContext.type == 'create' || scriptContext.type == 'copy') {
                        /* *** Logica de Tipo de Cambio Automatico *** */
                        if (LMRY_Result[0] == 'MX') {
                            if (libraryMail.getAuthorization(289, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'BR') {
                            if (libraryMail.getAuthorization(321, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'CO') {
                            if (libraryMail.getAuthorization(409, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'CL') {
                            if (libraryMail.getAuthorization(322, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'PE') {
                            if (libraryMail.getAuthorization(403, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'AR') {
                            if (libraryMail.getAuthorization(404, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                        /* *** Fin Logica de Tipo de Cambio Automatico *** */

                    } // Fin if (scriptContext.type == 'create')

                    var createdFrom = recordObj.getValue('createdfrom');

                    //SETEO DEL CUSTBODY LATAMREADY - BR TRANSACTION TYPE PARA FILTRAR LA COLUMNA CFOP
                    if (LMRY_Result[0] == 'BR' && LMRY_Result[2] == true && (scriptContext.type == 'create' || scriptContext.type == 'edit' || scriptContext.type == 'copy')) {
                        var transactionType = recordObj.getValue('custbody_lmry_br_transaction_type');
                        var createdFrom = recordObj.getValue('createdfrom');
                        if (transactionType == '' || transactionType == null || (createdFrom != '' && createdFrom != null)) {
                            var typeStandard = recordObj.getValue('type');
                            if (typeStandard != null && typeStandard != '') {
                                var searchTransactionType = search.create({
                                    type: 'customrecord_lmry_trantype',
                                    columns: ['internalid'],
                                    filters: [{
                                        name: 'name',
                                        operator: 'is',
                                        values: typeStandard
                                    }]
                                });
                                var resultTransactionType = searchTransactionType.run().getRange({
                                    start: 0,
                                    end: 1
                                });
                                if (resultTransactionType != null && resultTransactionType.length > 0) {
                                    log.debug('1');
                                    recordObj.setValue({
                                        fieldId: 'custbody_lmry_br_transaction_type',
                                        value: resultTransactionType[0].getValue('internalid')
                                    });
                                }

                            }
                        }
                    }//FIN CFOP BR


                    //CL CHANGE CURRENCY UF: SOLO TRANSFORM Y MAKE COPY
                    if (LMRY_Result[0] == 'CL' && libraryMail.getAuthorization(604, licenses) && ((scriptContext.type == 'create' && createdFrom) || scriptContext.type == 'copy')) {

                        var searchCurrencies = search.create({
                            type: 'currency', columns: ['symbol', 'internalid', 'name'],
                            filters: [{ name: 'isinactive', operator: 'is', values: 'F' }]
                        });

                        searchCurrencies = searchCurrencies.run().getRange(0, 1000);

                        var jsonCurrencies = {};
                        var fieldRateUF = '';

                        for (var i = 0; i < searchCurrencies.length; i++) {
                            var idCurrency = searchCurrencies[i].getValue('internalid');
                            var name = searchCurrencies[i].getValue('name');
                            var symbol = searchCurrencies[i].getValue('symbol');
                            symbol = symbol.toUpperCase();

                            jsonCurrencies[idCurrency] = { 'symbol': symbol, 'name': name };

                        }

                        var searchSetupTax = search.create({
                            type: 'customrecord_lmry_setup_tax_subsidiary', columns: ['custrecord_lmry_setuptax_cl_rate_uf'],
                            filters: [{ name: 'isinactive', operator: 'is', values: 'F' }, { name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: subsidiary }]
                        });

                        searchSetupTax = searchSetupTax.run().getRange(0, 1);

                        if (searchSetupTax && searchSetupTax.length && searchSetupTax[0].getValue('custrecord_lmry_setuptax_cl_rate_uf')) {
                            fieldRateUF = searchSetupTax[0].getValue('custrecord_lmry_setuptax_cl_rate_uf');
                        }

                        var currencyTransaction = recordObj.getValue('currency');
                        var tranDate = recordObj.getValue('trandate');

                        if (jsonCurrencies[currencyTransaction]['symbol'] == 'CLP' && fieldRateUF && recordObj.getField(fieldRateUF)) {

                            var rateUF = currency.exchangeRate({ source: 'CLF', target: 'CLP', date: tranDate });
                            recordObj.setValue(fieldRateUF, parseFloat(rateUF));

                            for (var i = 0; i < recordObj.getLineCount({ sublistId: 'item' }); i++) {

                                var amountUF = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_prec_unit_so', line: i });
                                var quantity = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });

                                if (parseFloat(amountUF) > 0 && parseFloat(rateUF) > 0) {

                                    amountUF = parseFloat(amountUF) * parseFloat(rateUF);
                                    amountUF = parseFloat(amountUF).toFixed(0);

                                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: amountUF });

                                    amountUF = parseFloat(quantity) * parseFloat(amountUF);

                                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: amountUF });

                                }

                            }


                        }

                    }//FIN CL CHANGE CURRENCY


                } // Fin if (type != 'print' && type != 'email')


            } catch (err) {
                recordObj = scriptContext.newRecord;
                libraryMail.sendemail2(' [ BeforeLoad ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
            }

        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
            try {

                // SuiteTax
                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                var ORCD = scriptContext.oldRecord;

                recordObj = scriptContext.newRecord;
                var type = scriptContext.type;
                var LMRY_Intern = recordObj.id;
                form = scriptContext.form;
                var type_interface = runtime.executionContext;
                var type_event = scriptContext.type;
                //Nombre de la transaccion
                typeC = recordObj.type;
                // Sale del proceso si es MAPREDUCE
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = libraryMail.getLicenses(subsidiary);

                var LMRY_Result = Validate_Access_CM(subsidiary, form, typeC, type, recordObj);

                //Universal Setting se realiza solo al momento de crear
                if (type_event == 'create' && (type_interface == 'USERINTERFACE' || type_interface == 'USEREVENT' || type_interface == 'CSVIMPORT')) {
                    var al_country = recordObj.getValue('custbody_lmry_subsidiary_country');
                    var type_document = recordObj.getValue('custbody_lmry_document_type');
                    var band = true;

                    if (library_Uni_Setting.auto_universal_setting(licenses, false)) {
                        //Solo si el campo LATAM - LEGAL DOCUMENT TYPE se encuentra vacío
                        if (type_interface == 'USERINTERFACE') {
                            if (recordObj.getValue('custpage_uni_set_status') == 'F' && (type_document == '' || type_document == null)) {
                                //Seteo campos cabecera, numero pre impreso y template
                                library_Uni_Setting.automatic_setfield(recordObj, false);
                                library_Uni_Setting.set_preimpreso(recordObj, LMRY_Result, licenses);
                                library_Uni_Setting.setear_datos_invoice(recordObj);
                                library_Uni_Setting.set_template(recordObj, licenses);
                                recordObj.setValue('custpage_uni_set_status', 'T');
                                band = false;
                            }
                        } else if (type_interface == 'USEREVENT' && (type_document == '' || type_document == null)) {
                            //Seteo campos cabecera, numero pre impreso y template
                            library_Uni_Setting.automatic_setfield(recordObj, false);
                            library_Uni_Setting.set_preimpreso(recordObj, LMRY_Result, licenses);
                            library_Uni_Setting.setear_datos_invoice(recordObj);
                            library_Uni_Setting.set_template(recordObj, licenses);
                            band = false;

                        } else if (type_interface == 'CSVIMPORT') {
                            var check_csv = recordObj.getValue('custbody_lmry_scheduled_process');
                            //Check box para controlar el seteo automático en el record anexado
                            if ((check_csv == false || check_csv == 'F') && (type_document == '' || type_document == null)) {
                                //Seteo campos cabecera, numero pre impreso y template
                                library_Uni_Setting.automatic_setfield(recordObj, false);
                                library_Uni_Setting.set_preimpreso(recordObj, LMRY_Result, licenses);
                                library_Uni_Setting.setear_datos_invoice(recordObj);
                                library_Uni_Setting.set_template(recordObj, licenses);

                                if (check_csv == 'F') {
                                    recordObj.setValue('custbody_lmry_scheduled_process', 'T');
                                } else {
                                    recordObj.setValue('custbody_lmry_scheduled_process', true);
                                }
                                band = false;
                            }
                        }

                        //Seteo de campo de columna Invoice Identifier
                        library_Uni_Setting.set_inv_identifier(recordObj);

                    }

                    var id_country = recordObj.getValue('custbody_lmry_subsidiary_country');
                    if (band && id_country == 48) {
                        setearFolioCO(recordObj);
                    }
                }

                //Logica de Tipo de Cambio Automatico
                var exchrate = false;
                switch (LMRY_Result[0]) {
                    case 'AR':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(404, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'BR':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(321, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CO':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(409, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CL':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(322, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'MX':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(289, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'PE':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && libraryMail.getAuthorization(403, licenses)) {
                            exchrate = true;
                        }
                        break;
                    default:
                        break;
                }
                if (exchrate) {
                    library_ExchRate.setExchRate(scriptContext);
                }

                // Nueva logica de Country WHT Lines
                if (ST_FEATURE == false || ST_FEATURE == "F") {
                    libWHTLines.beforeSubmitTransaction(scriptContext, licenses);
                }

                //log.debug('WTH CO', LMRY_Result[0]);
                switch (LMRY_Result[0]) {
                    //   case 'AR':
                    //     if (libraryMail.getAuthorization(200, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'BO':
                    //     if (libraryMail.getAuthorization(152, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    case 'BR':
                        if (libraryMail.getAuthorization(147, licenses) == true) {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                ST_TAX_Transaction.beforeSubmitTransaction(scriptContext);
                            } else {
                                Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                            }
                        }
                        break;
                    //   case 'CL':
                    //     if (libraryMail.getAuthorization(201, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'CO':
                    //     if (libraryMail.getAuthorization(150, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'CR':
                    //     if (libraryMail.getAuthorization(203, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    // //   case 'EC':
                    // //     if (libraryMail.getAuthorization(153, licenses) == true) {
                    // //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    // //     }
                    // //     break;
                    //   case 'SV':
                    //     if (libraryMail.getAuthorization(205, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'GT':
                    //     if (libraryMail.getAuthorization(207, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'MX':
                    //     if (libraryMail.getAuthorization(209, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'PA':
                    //     if (libraryMail.getAuthorization(211) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'PY':
                    //     if (libraryMail.getAuthorization(213, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'PE':
                    //     if (libraryMail.getAuthorization(214, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;
                    //   case 'UY':
                    //     if (libraryMail.getAuthorization(216, licenses) == true) {
                    //       Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    //     }
                    //     break;

                }

                /*************************************
                 * Auto Percepcions para Argentina,
                 * Brasil y Paraguay
                 *************************************/

                if (recordObj.getValue('memo') != 'VOID') {
                    var swAutoPe = false;
                    if (LMRY_Result[0] == 'AR') {
                        swAutoPe = libraryMail.getAuthorization(142, licenses);
                    }
                    if (LMRY_Result[0] == 'BR') {
                        swAutoPe = libraryMail.getAuthorization(143, licenses);
                    }
                    if (LMRY_Result[0] == 'BO') {
                        swAutoPe = libraryMail.getAuthorization(230, licenses);
                    }
                    if (LMRY_Result[0] == 'PE') {
                        swAutoPe = libraryMail.getAuthorization(231, licenses);
                    }
                    if (LMRY_Result[0] == 'CL') {
                        swAutoPe = libraryMail.getAuthorization(232, licenses);
                    }
                    if (LMRY_Result[0] == 'CO') {
                        swAutoPe = libraryMail.getAuthorization(233, licenses);
                    }
                    if (LMRY_Result[0] == 'CR') {
                        swAutoPe = libraryMail.getAuthorization(234, licenses);
                    }
                    if (LMRY_Result[0] == 'EC') {
                        swAutoPe = libraryMail.getAuthorization(235, licenses);
                    }
                    if (LMRY_Result[0] == 'SV') {
                        swAutoPe = libraryMail.getAuthorization(236, licenses);
                    }
                    if (LMRY_Result[0] == 'GT') {
                        swAutoPe = libraryMail.getAuthorization(237, licenses);
                    }
                    if (LMRY_Result[0] == 'MX') {
                        swAutoPe = libraryMail.getAuthorization(238, licenses);
                    }
                    if (LMRY_Result[0] == 'PA') {
                        swAutoPe = libraryMail.getAuthorization(239, licenses);
                    }
                    if (LMRY_Result[0] == 'PY') {
                        swAutoPe = libraryMail.getAuthorization(240, licenses);
                    }
                    if (LMRY_Result[0] == 'UY') {
                        swAutoPe = libraryMail.getAuthorization(241, licenses);
                    }

                    // Si hay acceso Procesa
                    if (swAutoPe) {
                        // Realiza la redireccion de cuentas
                        Library_AutoPercepcionDesc.autoperc_beforeSubmit(scriptContext, LMRY_Result[0], scriptContext.type);
                    }
                }

                // LatamTax - SuiteTax
                if (scriptContext.type == 'delete') {
                    if (ST_FEATURE == true || ST_FEATURE == "T") {
                        switch (LMRY_Result[0]) {
                            case "CL":
                                ST_Library_Transaction_CL.deleteTaxResultRC(LMRY_Intern);
                                break;
                            case "MX":
                                MX_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                                break;
                            case "CO":
                                CO_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                                if (libraryMail.getAuthorization(340, licenses) == true) {
                                    CO_ST_WhtLibrary_Lines.deleteRelatedRecords(recordObj.id, "creditmemo");
                                }
                                break;
                            case "SV":
                                SV_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                                break;
                        }
                    }
                }

                if (LMRY_Result[0] == "BR") {
                    if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {
                        setBRDiscountAmount(recordObj);
                    }

                    if (scriptContext.type == "delete") {
                        if (libraryMail.getAuthorization(416, licenses)) {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                ST_WHT_Transaction.deleteGeneratedRecords(recordObj);
                            } else {
                                Library_Tax_WHT.deleteGeneratedRecords(recordObj);
                            }
                        }
                    }
                }

                //SETEO DE CAMPOS BASE 0%, 12% Y 14%
                var eventsEC = ['create', 'copy', 'edit'];
                if (LMRY_Result[0] == 'EC' && libraryMail.getAuthorization(42, licenses) && eventsEC.indexOf(scriptContext.type) != -1) {
                    libraryEcBaseAmounts.setBaseAmounts(recordObj, '2');
                }

                if (LMRY_Result[0] == "CO" && libraryMail.getAuthorization(666, licenses) && scriptContext.type == 'edit' && type_interface != 'USERINTERFACE') {

                    //feature cabecera
                    if (libraryMail.getAuthorization(27, licenses)) {
                        var rete_change_wht = Library_Duplicate.Verification_Duplicate_Fields(Library_Duplicate.Old_Values_WHT(ORCD), recordObj);
                        var lines_change = Library_Duplicate.Verification_Duplicate_Lines(recordObj, ORCD);
                        if (Library_Duplicate.Validate_EIDocument(recordObj) && (rete_change_wht || lines_change)) {
                            statusError = true;
                        }
                    }

                    //if feature lineas
                    if (libraryMail.getAuthorization(340, licenses)) {
                        var lines_change = Library_Duplicate.Verification_Duplicate_Lines(recordObj, ORCD);
                        if (Library_Duplicate.Validate_EIDocument(recordObj) && lines_change) {
                            statusError = true;
                        }
                    }
                }

                if (LMRY_Result[0] == "CO") {
                    if (libraryMail.getAuthorization(721, licenses) == true && scriptContext.type == 'edit') {
                        recordObj.setValue('custbody_lmry_scheduled_process', false);
                    }
                }


            } catch (err) {
                recordObj = scriptContext.newRecord;
                libraryMail.sendemail2(' [ BeforeSubmit ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
            }

            if (statusError) {

                var Language = runtime.getCurrentScript().getParameter({
                    name: 'LANGUAGE'
                });

                Language = Language.substring(0, 2);

                var msg = {
                    "en": "You cannot make changes to withholdings since the document is already issued electronically.",
                    "es": "No se puede realizar modificaciones en retenciones dado que el documento ya se encuentra emitido electrónicamente.",
                    "pt": "Você não pode fazer alterações nas retenções porque o documento já foi emitido eletronicamente."
                }

                throw msg[Language] || msg["en"];
            } else {
                return true
            }
        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            try {

                //SuiteTax
                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                var ORCD = scriptContext.oldRecord;

                recordObj = scriptContext.newRecord;
                var type = scriptContext.type;
                var LMRY_Intern = recordObj.id;
                form = scriptContext.form;
                typeC = recordObj.type;
                var type_interface = runtime.executionContext;

                // Sale del proceso si es MAPREDUCE
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = libraryMail.getLicenses(subsidiary);

                var LMRY_Result = Validate_Access_CM(subsidiary, form, typeC, type, recordObj);
                var type_event = scriptContext.type;

                //Universal Setting se realiza solo al momento de crear
                if (type_event == 'create' && (type_interface == 'USERINTERFACE' || type_interface == 'USEREVENT' || type_interface == 'CSVIMPORT')) {
                    if (type_interface == 'USERINTERFACE') {
                        //Mediante el custpage se conoce que el seteo de cabecera fue realizado por Universal Setting
                        if (recordObj.getValue('custpage_uni_set_status') == 'T') {
                            //Seteo de campos perteneciente a record anexado
                            library_Uni_Setting.automatic_setfieldrecord(recordObj);
                        }
                    } else if (type_interface == 'USEREVENT' && (type_document == '' || type_document == null)) {
                        var al_country = recordObj.getValue('custbody_lmry_subsidiary_country');
                        if (library_Uni_Setting.auto_universal_setting(licenses, false)) {
                            //Seteo de campos perteneciente a record anexado
                            library_Uni_Setting.automatic_setfieldrecord(recordObj);
                        }
                    } else if (type_interface == 'CSVIMPORT') {
                        //Mediante el siguiente campo se conoce si seteo de cabecera fue realizado por Universal Setting
                        var check_csv = recordObj.getValue('custbody_lmry_scheduled_process');

                        if (check_csv == 'T' || check_csv == true) {
                            //Seteo de campos perteneciente a record anexado
                            library_Uni_Setting.automatic_setfieldrecord(recordObj);

                            if (check_csv == 'T') {
                                recordObj.setValue('custbody_lmry_scheduled_process', 'F');
                            } else {
                                recordObj.setValue('custbody_lmry_scheduled_process', false);
                            }
                        }
                    }
                }

                if (type == 'delete') {
                    // Para Colombia, Bolivia y Paraguay - Enabled Feature WHT Latam
                    switch (LMRY_Result[0]) {
                        case 'CO':
                            if (libraryMail.getAuthorization(27, licenses) == true) {
                                // Elimina registros
                                libraryValidation.Delete_JE(LMRY_Intern);

                                // Delete invoice
                                libraryValidation.Delete_CM('invoice', LMRY_Intern);
                            }
                            break;
                        case 'BO':
                            if (libraryMail.getAuthorization(46, licenses) == true) {
                                // Elimina registros
                                libraryValidation.Delete_JE(LMRY_Intern);

                                // Delete invoice
                                libraryValidation.Delete_CM('invoice', LMRY_Intern);
                            }
                            break;
                        case 'PY':
                            if (libraryMail.getAuthorization(47, licenses) == true) {
                                // Elimina registros
                                libraryValidation.Delete_JE(LMRY_Intern);

                                // Delete invoice
                                libraryValidation.Delete_CM('invoice', LMRY_Intern);
                            }
                            break;
                    }

                    // Sale de la funcion
                    return true;
                }

                if (type == 'create' || type == 'edit' || type == 'copy') {
                    if (ST_FEATURE == false || ST_FEATURE == "F") {
                        var transactionType = 'creditmemo';
                        libWHTLines.afterSubmitTransaction(scriptContext, type, LMRY_Intern, transactionType, licenses);
                    }
                }

                if (type == 'create' || type == 'edit') {
                    var currency = recordObj.getValue({
                        fieldId: 'currency'
                    });
                    // Subsidiria de Peru, Republica Dominicana, Mexico y Ecuador
                    if (LMRY_Result[0] == 'PE' || LMRY_Result[0] == 'MX' || LMRY_Result[0] == 'EC' || LMRY_Result[0] == 'DO') {

                        if (currency == '' || currency == null) {
                            return true;
                        }
                        //	Se realiza la busqueda de los campos symbol y name por el id de la moneda
                        var monedaTexto = search.lookupFields({
                            type: search.Type.CURRENCY,
                            id: currency,
                            columns: ['name', 'symbol']
                        });
                        //	Se realiza la busqueda de los campos symbol y name por el id de la moneda
                        var mon_name = monedaTexto.name;
                        var mon_symb = monedaTexto.symbol;
                        //log.debug('monedaTexto', mon_name + ';' + mon_symb);

                        // Guarda Monto en Letras
                        var imptotal = recordObj.getValue({
                            fieldId: 'total'
                        });
                        var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, mon_name, '', 'Y');

                        // Actualiza solo el campo - Latam - Monto en Letras (Custom Body)
                        //log.debug('monto', impletras);
                        record.submitFields({
                            type: 'creditmemo',
                            id: LMRY_Intern,
                            values: {
                                'custbody_lmry_pa_monto_letras': impletras
                            }
                        });
                    }

                    // Subsidiria de Peru, Panama, Mexico y Ecuador
                    if (LMRY_Result[0] == 'PA') {
                        // Guarda Monto en Letras
                        var imptotal = recordObj.getValue({
                            fieldId: 'total'
                        });
                        var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, '', '', 'Y');

                        // Actualiza solo el campo - Latam - Monto en Letras (Custom Body)
                        record.submitFields({
                            type: 'creditmemo',
                            id: LMRY_Intern,
                            values: {
                                'custbody_lmry_pa_monto_letras': impletras
                            }
                        });
                    }

                    // Subsidiaria Paraguay
                    if (LMRY_Result[0] == 'PY') {

                        //log.debug('currency', currency);
                        if (currency == '' || currency == null) {
                            return true;
                        }

                        var monedaTexto = search.lookupFields({
                            type: search.Type.CURRENCY,
                            id: currency,
                            columns: ['name', 'symbol']
                        });
                        var mon_name = monedaTexto.name;
                        var mon_symb = monedaTexto.symbol;

                        // Restamos el custbody_lmry_wtax_wamt al monto Total por que NS despues de grabar el documento recien le
                        // Guarda Monto
                        var imptotal = 0.00;
                        imptotal = parseFloat(recordObj.getValue({
                            fieldId: 'total'
                        }));
                        imptotal = imptotal.toFixed(2);

                        // Monto en Letras Parametros: Importe, Moneda, Simbolo y concadenador
                        var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'Y');

                        // Actualiza solo el campo - Latam - Monto en Letras (Custom Body)
                        record.submitFields({
                            type: 'creditmemo',
                            id: LMRY_Intern,
                            values: {
                                'custbody_lmry_pa_monto_letras': impletras
                            }
                        });
                    }

                    // Solo para Colombia
                    if (LMRY_Result[0] == 'CO') {
                        //log.debug('currency', currency);
                        if (currency == '' || currency == null) {
                            return true;
                        }
                        //	Se realiza la busqueda de los campos symbol y name por el id de la moneda
                        var monedaTexto = search.lookupFields({
                            type: search.Type.CURRENCY,
                            id: currency,
                            columns: ['name', 'symbol']
                        });
                        var mon_name = monedaTexto.name;
                        var mon_symb = monedaTexto.symbol;
                        //log.debug('monedaTexto', mon_name + ';' + mon_symb);
                        // Guarda Monto en Letras
                        var imptotal = recordObj.getValue({
                            fieldId: 'total'
                        });

                        // Monto en Letras Parametros: Importe, Moneda, Simbolo y concadenador
                        var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'Y');

                        // Actualiza solo el campo - Latam - CO Amount in Words (Custom Body)
                        //log.debug('monto antes setvalue', impletras);
                        // recordObj.setValue({
                        //   fieldId: 'custbody_lmry_co_monto_letras',
                        //   value: impletras
                        // });
                        if (ST_FEATURE == false || ST_FEATURE == "F") {
                            record.submitFields({
                                type: 'creditmemo',
                                id: LMRY_Intern,
                                values: {
                                    'custbody_lmry_co_monto_letras': impletras
                                }
                            });
                        }

                    }

                    // Solo para El Salvador
                    if (LMRY_Result[0] == 'SV') {

                        if (currency == '' || currency == null) {
                            return true;
                        }
                        //	Se realiza la busqueda de los campos symbol y name por el id de la moneda
                        var monedaTexto = search.lookupFields({
                            type: search.Type.CURRENCY,
                            id: currency,
                            columns: ['name', 'symbol']
                        });
                        var mon_name = monedaTexto.name;
                        var mon_symb = monedaTexto.symbol;

                        // Guarda Monto en Letras
                        // var imptotal = recordObj.getValue({
                        //   fieldId: 'total'
                        // });

                        var imptotal = 0.00;
                        imptotal = parseFloat(recordObj.getValue({
                            fieldId: 'total'
                        }));
                        // Monto en Letras Parametros: Importe, Moneda, Simbolo y concadenador
                        // var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'Y');

                        var impletras = libraryNumber.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'CON');

                        record.submitFields({
                            type: 'creditmemo',
                            id: LMRY_Intern,
                            values: {
                                'custbody_lmry_pa_monto_letras': impletras
                            }
                        });

                        // recordObj.setValue({
                        //   fieldId: 'custbody_lmry_pa_monto_letras',
                        //   value: impletras
                        // });

                    }

                    // Solo para Mexico
                    if (LMRY_Result[0] == 'MX') {
                        /*************************************************
                         * Custom Record : LatamReady - Features
                         * 22 = Redireccion de Cuentas
                         *************************************************/
                        if (libraryMail.getAuthorization(22, licenses) == true) {
                            if (ST_FEATURE == false || ST_FEATURE == "F") {
                                // Elimina los asientos
                                libraryValidation.Delete_JE(LMRY_Intern);

                                // Realiza la redireccion de cuentas
                                libraryRedirect.Create_Redirect_CM(LMRY_Intern);
                            }
                        }
                    }

                    // Solo para Colombia y Bolivia - Enabled Feature WHT Latam
                    /*************************************************
                     * Custom Record : LatamReady - Features
                     * 27 = Latam - WHT for Colombia
                     * 46 = Latam - WHT for Bolivia
                     *************************************************/
                    switch (LMRY_Result[0]) {
                        case 'CO':
                            if (libraryMail.getAuthorization(27, licenses) == true) {
                                libraryValidation.Create_WHT_Latam('creditmemo', LMRY_Intern, ORCD);
                            }
                            break;
                        case 'BO':
                            if (libraryMail.getAuthorization(46, licenses) == true) {
                                libraryValidation.Create_WHT_Latam('creditmemo', LMRY_Intern);
                            }
                            break;
                        default:

                    }
                }

                // Nueva logica de colombia
                //log.debug('WTH CO', LMRY_Result[0]);
                if (LMRY_Result[0] == "BR") {
                    if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {
                        if ('create' == scriptContext.type) {
                            Library_BRDup.assignPreprinted(recordObj, licenses);
                        }
                        var recordBR = record.load({
                            type: "creditmemo",
                            id: scriptContext.newRecord.id
                        })
                        if (libraryMail.getAuthorization(147, licenses) == true) {
                            var context = {
                                type: scriptContext.type,
                                newRecord: recordBR
                            };
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                ST_TAX_Transaction.afterSubmitTransaction(context, true);
                            } else {
                                Library_WHT_Transaction.afterSubmitTransaction(context, true);
                            }
                        }
                        recordBR.save({
                            ignoreMandatoryFields: true,
                            disableTriggers: true,
                            enableSourcing: true
                        });

                        if (libraryMail.getAuthorization(416, licenses)) {
                            recordObj = scriptContext.newRecord;
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                ST_WHT_Transaction.LatamTaxWithHoldingBR(recordObj, type);
                            } else {
                                Library_Tax_WHT.LatamTaxWithHoldingBR(recordObj, type);
                            }
                        }
                    }
                }

                // LatamTax - SuiteTax
                if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {

                    if (ST_FEATURE == true || ST_FEATURE == "T") {

                        var ST_RecordObj = record.load({
                            type: "creditmemo",
                            id: recordObj.id
                        });

                        var ST_Context = {
                            type: scriptContext.type,
                            newRecord: ST_RecordObj
                        };

                        switch (LMRY_Result[0]) {

                            case "CL":
                                if (libraryMail.getAuthorization(606, licenses) == true) {
                                    ST_Library_Transaction_CL.afterSubmitTransaction(ST_Context);
                                    ST_RecordObj.save({
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true,
                                        enableSourcing: true
                                    });
                                }
                                break;

                            case "MX":
                                if (libraryMail.getAuthorization(672, licenses) == true) {
                                    MX_ST_TaxLibrary.setTaxTransaction(ST_Context);
                                    ST_RecordObj.save({
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true,
                                        enableSourcing: true,
                                    });
                                }
                                break;

                            case "CO":
                                if (libraryMail.getAuthorization(645, licenses) == true) {
                                    CO_ST_TaxLibrary.setTaxTransaction(ST_Context);
                                    ST_RecordObj.save({ ignoreMandatoryFields: true, disableTriggers: true, enableSourcing: true });
                                }
                                if (libraryMail.getAuthorization(340, licenses) == true) {
                                    ST_RecordObj = scriptContext.newRecord;
                                    CO_ST_WhtLibrary_Lines.setWHTLineTransaction(ST_RecordObj, scriptContext, licenses);
                                }
                                break;

                            case "SV":
                                if (libraryMail.getAuthorization(723, licenses) == true) {
                                    SV_ST_TaxLibrary.setTaxTransaction(ST_Context);
                                    ST_RecordObj.save({
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true,
                                        enableSourcing: true,
                                    });
                                }
                                break;

                        }

                    }

                }

                if (type == 'create' || type == 'edit') {
                    if (LMRY_Result[0] == 'AR' && libraryMail.getAuthorization(540, licenses)) {
                        GroupLine(scriptContext, LMRY_Intern);
                    }
                }

                //EC TRANSACTION FIELDS
                if ((type == 'create' || type == 'edit') && LMRY_Result[0] == 'EC' && (libraryMail.getAuthorization(630, licenses) || libraryMail.getAuthorization(639, licenses))) {
                    ECsetAmounts(LMRY_Intern);
                }

                // Detraction (Credit Memo)
                if (['create', 'edit'].indexOf(type) != -1 && LMRY_Result[0] == 'PE' && libraryMail.getAuthorization(568, licenses)) {

                    if (type == 'edit') {
                        var journalApply = 0;
                        // Abre Transaccion Credit Memo
                        var recObj = record.load({
                            type: 'creditmemo',
                            id: LMRY_Intern
                        });
                        var c_invoices = recObj.getLineCount({
                            sublistId: 'apply'
                        });

                        for (var i = 0; i < c_invoices; i++) {
                            recObj.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: false
                            });
                            var tranId = recObj.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: i
                            });
                            if (tranId == 'Journal') {
                                journalApply = recObj.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'doc',
                                    line: i
                                });
                            }
                        }
                        recObj.save({
                            disableTriggers: true
                        });

                        if (journalApply) {
                            record.delete({
                                type: 'journalentry',
                                id: journalApply
                            });
                        }

                    }

                    var featureSub = runtime.isFeatureInEffect({
                        feature: 'SUBSIDIARIES'
                    });

                    var featureAprove = runtime.getCurrentScript().getParameter({
                        name: 'CUSTOMAPPROVALJOURNAL'
                    });

                    var JEamount = 0;
                    var idJournal = 0;
                    var detractionAccount = 0;
                    var percent = recordObj.getValue('custbody_lmry_porcentaje_detraccion') || 0;
                    percent = parseFloat(percent) / 100;
                    // var baseAmount = recordObj.getValue("total") || 0.00;
                    // baseAmount = parseFloat(baseAmount);
                    // JEamount = baseAmount * parseFloat(percent) / 100;
                    // JEamount = parseFloat(Math.round(JEamount * 100 + 1e-3)) / 100;
                    var numItems = recordObj.getLineCount({ sublistId: "item" });
                    for (var i = 0; i < numItems; i++) {
                        var grossAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: i }) || 0.00;
                        grossAmount = parseFloat(grossAmount);
                        var whtAmtLine = grossAmount * percent;
                        whtAmtLine = Math.round(whtAmtLine * 1e2 + 1e-3) / 1e2;
                        JEamount = Math.round((JEamount + whtAmtLine) * 1e2 + 1e-3) / 1e2;
                    }
                    var searchSetupSubsidiary = search.create({
                        type: "customrecord_lmry_setup_tax_subsidiary",
                        filters: [
                            ['isinactive', 'is', 'F']
                        ],
                        columns: ['custrecord_lmry_setuptax_pe_det_account']
                    });
                    if (featureSub) {
                        searchSetupSubsidiary.filters.push(search.createFilter({
                            name: 'custrecord_lmry_setuptax_subsidiary',
                            operator: 'is',
                            values: [recordObj.getValue('subsidiary')]
                        }));
                    }
                    searchSetupSubsidiary = searchSetupSubsidiary.run().getRange(0, 1);

                    if (searchSetupSubsidiary != null && searchSetupSubsidiary != '') {
                        detractionAccount = searchSetupSubsidiary[0].getValue('custrecord_lmry_setuptax_pe_det_account') || 0;
                    }

                    if (JEamount > 0 && detractionAccount) {
                        // Crea transaccion Journal Entry
                        var newJournal = record.create({
                            type: record.Type.JOURNAL_ENTRY
                        });

                        if (featureSub) {
                            newJournal.setValue('subsidiary', recordObj.getValue('subsidiary'));
                        }
                        newJournal.setValue('trandate', recordObj.getValue('trandate'));
                        newJournal.setValue('postingperiod', recordObj.getValue('postingperiod'));
                        if (LMRY_Intern) {
                            newJournal.setValue('custbody_lmry_reference_transaction', LMRY_Intern);
                            newJournal.setValue('custbody_lmry_reference_transaction_id', LMRY_Intern);
                        }
                        newJournal.setValue('custbody_lmry_es_detraccion', false);
                        if (featureAprove == 'T' || featureAprove == true) {
                            newJournal.setValue('approvalstatus', 2);
                        }
                        newJournal.setValue('currency', recordObj.getValue('currency'));
                        newJournal.setValue('exchangerate', recordObj.getValue('exchangerate'));
                        newJournal.setValue('memo', 'Detraccion - Nota de Credito ID: ' + LMRY_Intern);

                        // Segmentation
                        var lineDep = recordObj.getValue('department');
                        var lineCla = recordObj.getValue('class');
                        var lineLoc = recordObj.getValue('location');
                        // Line from
                        newJournal.setSublistValue('line', 'account', 0, detractionAccount);
                        newJournal.setSublistValue('line', 'credit', 0, JEamount);
                        newJournal.setSublistValue('line', 'memo', 0, 'Detraction Amount');
                        newJournal.setSublistValue('line', 'entity', 0, recordObj.getValue('entity'));
                        if (lineDep != null && lineDep != '' && lineDep != undefined) {
                            newJournal.setSublistValue('line', 'department', 0, lineDep);
                        }
                        if (lineCla != null && lineCla != '' && lineCla != undefined) {
                            newJournal.setSublistValue('line', 'class', 0, lineCla);
                        }
                        if (lineLoc != null && lineLoc != '' && lineLoc != undefined) {
                            newJournal.setSublistValue('line', 'location', 0, lineLoc);
                        }
                        // Line to
                        newJournal.setSublistValue('line', 'account', 1, recordObj.getValue('account'));
                        newJournal.setSublistValue('line', 'debit', 1, JEamount);
                        newJournal.setSublistValue('line', 'memo', 1, 'Detraction Amount');
                        newJournal.setSublistValue('line', 'entity', 1, recordObj.getValue('entity'));
                        if (lineDep != null && lineDep != '' && lineDep != undefined) {
                            newJournal.setSublistValue('line', 'department', 1, lineDep);
                        }
                        if (lineCla != null && lineCla != '' && lineCla != undefined) {
                            newJournal.setSublistValue('line', 'class', 1, lineCla);
                        }
                        if (lineLoc != null && lineLoc != '' && lineLoc != undefined) {
                            newJournal.setSublistValue('line', 'location', 1, lineLoc);
                        }
                        idJournal = newJournal.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            dissableTriggers: true
                        });
                    }

                    // Abre Transaccion Credit Memo
                    var recObj = record.load({
                        type: 'creditmemo',
                        id: LMRY_Intern
                    })
                    var c_invoices = recObj.getLineCount({
                        sublistId: 'apply'
                    });

                    /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                     * Fecha : 18 de Agosto de 2021
                     * Se agrego asociar la transaccion origen con el CM
                     *    Latam - Transaction Reference ID
                     * * * * * * * * * * * * * * * * * * * * * * * * * * */
                    var IDCreatedFrom = recObj.getValue('createdfrom');
                    if (IDCreatedFrom == '' || IDCreatedFrom == null) {
                        IDCreatedFrom = recObj.getValue('custbody_lmry_reference_transaction_id');
                        if (IDCreatedFrom != '' && IDCreatedFrom != null) {
                            recObj.setValue('createdfrom', IDCreatedFrom);
                        }
                    }

                    for (var i = 0; i < c_invoices; i++) {
                        var tranId = recObj.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'doc',
                            line: i
                        });
                        if (tranId == idJournal) {
                            recObj.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: true
                            });
                            recObj.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'amount',
                                line: i,
                                value: JEamount
                            });
                        }
                        if (tranId == IDCreatedFrom) {
                            recObj.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: true
                            });
                            recObj.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'amount',
                                line: i,
                                value: recObj.getValue('total') - JEamount
                            });
                        }
                    }

                    recObj.save({
                        disableTriggers: true
                    });
                }

                /*****************************************************
                 Update Transaction Fields Peru
                 -----------------------------------------------------
                 User : Richard Galvez Lopez
                 Date : 18/11/2021
                ******************************************************/
                PE_libMapTransactions.updateTransactionFields(scriptContext);
                /*****************************************************/

            } catch (err) {
                recordObj = scriptContext.newRecord;
                libraryMail.sendemail2(' [ AfterSubmit ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
            }
            return true;
        }

        /* ------------------------------------------------------------------------------------------------------
         * A la variable featureId se le asigna el valor que le corresponde
         * --------------------------------------------------------------------------------------------------- */
        function Validate_Access_CM(ID, form, typeC, type, recordObj) {

            try {

                var LMRY_access = false;
                var LMRY_countr = new Array();
                var LMRY_Result = new Array();

                // Inicializa variables Locales y Globales
                LMRY_countr = libraryMail.Validate_Country(ID);

                // Verifica que el arreglo este lleno
                if (LMRY_countr.length < 1) {
                    LMRY_Result[0] = '';
                    LMRY_Result[1] = '-None-';
                    LMRY_Result[2] = LMRY_access;
                    return LMRY_Result;
                }

                LMRY_access = libraryMail.getCountryOfAccess(LMRY_countr, licenses);

                // Asigna Valores
                LMRY_Result[0] = LMRY_countr[0];
                LMRY_Result[1] = LMRY_countr[1];
                LMRY_Result[2] = LMRY_access;

            } catch (err) {
                libraryMail.sendemail2(' [ Validate_Access_CM ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
            }

            return LMRY_Result;
        }

        function GroupLine(context, Record_ID) {
            var recordObj = context.newRecord;

            if (context.type != 'create') {
                DeleteGroupLine(Record_ID);
            }

            // Declaracion de Arreglos
            var arr_DatFil = [];
            var arr_PosFil = -1;

            var tax_group = search.create({
                type: "customrecord_lmry_setup_taxcode_group",
                filters: [{
                    name: 'isinactive',
                    operator: 'is',
                    values: ['F']
                }],
                columns: ["internalid", "custrecord_lmry_setup_taxcode_country",
                    search.createColumn({
                        name: "custrecord_lmry_setup_taxcode_group",
                        sort: search.Sort.ASC
                    }), "custrecord_lmry_setup_taxcode",
                    search.createColumn({
                        name: "custrecord_lmry_setup_id_custbody",
                        join: "custrecord_lmry_setup_taxcode_group"
                    }),
                    search.createColumn({
                        name: "custrecord_lmry_setup_amount_to",
                        join: "custrecord_lmry_setup_taxcode_group"
                    })
                ]
            });

            var result_grps = tax_group.run().getRange(0, 1000);

            if (result_grps != null && result_grps.length > 0) {
                for (var TaxLine = 0; TaxLine < result_grps.length; TaxLine++) {
                    // Declaracion de JSON y Arreglo Tax Group
                    var arr_DatCol = {};
                    arr_DatCol["TaxGroup"] = ''; // Latam - Tax Code Group
                    arr_DatCol["TaxCodes"] = ''; // Latam - Tax Code
                    arr_DatCol["TaxField"] = ''; // Latam - Setup ID Custbody
                    arr_DatCol["TaxBase"] = ''; // Latam - Setup Amount To
                    arr_DatCol["TaxAmoun"] = 0; // Amount

                    var arr_Fields = result_grps[TaxLine].columns;

                    // TaxLine = Filas del TAX Group
                    arr_DatCol.TaxGroup = result_grps[TaxLine].getValue(arr_Fields[2]); // Latam - Tax Code Group
                    arr_DatCol.TaxCodes = result_grps[TaxLine].getValue(arr_Fields[3]); // Latam - Tax Code
                    arr_DatCol.TaxField = result_grps[TaxLine].getValue(arr_Fields[4]); // Latam - Setup ID Custbody
                    arr_DatCol.TaxBase = result_grps[TaxLine].getValue(arr_Fields[5]); // Latam - Setup Amount To
                    arr_DatCol.TaxAmoun = 0; // Amount

                    if (!arr_DatCol.TaxBase) {
                        continue;
                    }

                    var baseBill = '';
                    switch (arr_DatCol.TaxBase) {
                        case "1":
                            baseBill = 'grossamt';
                            break;
                        case "2":
                            baseBill = 'tax1amt';
                            break;
                        case "3":
                            baseBill = 'amount';
                            break;
                    }

                    // arr_RowSws = switch de si existen lienas
                    var arr_RowSws = false;

                    /*******************************
                     * Solo para la sublista Items
                     *******************************/
                    var cantidad_items = recordObj.getLineCount({
                        sublistId: 'item'
                    });
                    if (cantidad_items > 0) {
                        for (var ItemLine = 0; ItemLine < cantidad_items; ItemLine++) {
                            var lin_taxcode = recordObj.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'taxcode',
                                line: ItemLine
                            });
                            var lin_amounts = recordObj.getSublistValue({
                                sublistId: 'item',
                                fieldId: baseBill,
                                line: ItemLine
                            });
                            // Compara codigos de impuesto
                            if (arr_DatCol.TaxCodes == lin_taxcode) {
                                arr_RowSws = true;
                                arr_DatCol.TaxAmoun = parseFloat(arr_DatCol.TaxAmoun) + parseFloat(lin_amounts);
                            }
                        }
                    } // Solo para la sublista Items

                    // Solo si a capturado valores
                    if (arr_RowSws == true) {
                        // Incrementa las Filas
                        arr_PosFil = arr_PosFil + 1;

                        // arr_DatCol = Filas de la agrupacion
                        arr_DatFil[arr_PosFil] = arr_DatCol;
                    }
                } // Fin Barrido del grupo de impuestos

                /**********************************
                 * Realiza la agrupacion por
                 * Tax Code Group, Suma importes
                 * Solo si existe informacion
                 **********************************/
                //arr_DatFil[0].TaxGroup != '' && arr_DatFil[0].TaxGroup != null
                if (arr_DatFil.length > 0 && arr_DatFil != null) {
                    var aux_DatCol = {};
                    aux_DatCol["TaxGroup"] = ''; // Latam - Tax Code Group
                    var aux_PosFil = -1;
                    var aux_DatFil = [];
                    // Carga el arreglo con el JSON
                    aux_DatFil[aux_PosFil] = aux_DatCol;
                    for (var nCols = 0; nCols < arr_DatFil.length; nCols++) {
                        if (aux_DatFil[aux_PosFil].TaxGroup != arr_DatFil[nCols].TaxGroup) {
                            var aux_DatCol = {};
                            aux_DatCol["TaxGroup"] = arr_DatFil[nCols].TaxGroup; // Latam - Tax Code Group
                            aux_DatCol["TaxCodes"] = ''; // Latam - Tax Code
                            aux_DatCol["TaxField"] = ''; // Latam - Setup ID Custbody
                            aux_DatCol["TaxAmoun"] = 0; // Amount

                            // Incrementa Fila
                            aux_PosFil = aux_PosFil + 1;

                            // Carga el arreglo con el JSON
                            aux_DatFil[aux_PosFil] = aux_DatCol;
                        }
                        aux_DatFil[aux_PosFil].TaxGroup = arr_DatFil[nCols].TaxGroup; // Latam - Tax Code Group
                        aux_DatFil[aux_PosFil].TaxField = arr_DatFil[nCols].TaxField; // Latam - Setup ID Custbody
                        aux_DatFil[aux_PosFil].TaxAmoun = parseFloat(aux_DatFil[aux_PosFil].TaxAmoun) +
                            parseFloat(arr_DatFil[nCols].TaxAmoun); // Amount
                    }

                    /**********************************
                     * Graba  en el record
                     * LatamReady - Transaction Fields
                     * los importes acumula
                     **********************************/
                    var Record_TFS = '';

                    // Crea el registro nuevo
                    Record_TFS = record.create({
                        type: 'customrecord_lmry_transactions_fields',
                        isDynamic: true
                    });

                    // Latam - Related Transaction
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f',
                        value: recordObj.id
                    });
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f_id',
                        value: recordObj.id
                    });
                    // Latam - Exento
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f_exento',
                        value: 0
                    });
                    // Latam - IVA
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f_iva',
                        value: 0
                    });
                    // Latam - Neto Gravado
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f_gravado',
                        value: 0
                    });
                    // Latam - Neto No Gravado
                    Record_TFS.setValue({
                        fieldId: 'custrecord_lmry_transaction_f_no_gravado',
                        value: 0
                    });

                    // Actualiza los campos de Record
                    for (var nCols = 0; nCols < aux_DatFil.length; nCols++) {
                        // nCols = Fila del arreglo
                        // [nCols][2] = Latam - Setup ID Custbody
                        // [nCols][3] = Amount
                        Record_TFS.setValue({
                            fieldId: aux_DatFil[nCols].TaxField,
                            value: Math.round(parseFloat(aux_DatFil[nCols].TaxAmoun) * 100) / 100
                        });
                    }

                    // Graba el record
                    Record_TFS.save({
                        ignoreMandatoryFields: true,
                        disableTriggers: true,
                        enableSourcing: true
                    });
                } // Solo si se cargo Tax
            } // Solo si tiene Items

        }

        function DeleteGroupLine(recordID) {

            var tax_group = search.create({
                type: 'customrecord_lmry_transactions_fields',
                columns: ['internalid', 'custrecord_lmry_transaction_f'],
                filters: [{
                    name: 'custrecord_lmry_transaction_f_id',
                    operator: 'equalto',
                    values: recordID
                }]
            });

            var result_tax = tax_group.run().getRange(0, 1000);

            if (result_tax != null && result_tax.length > 0) {
                for (var delLine = 0; delLine < result_tax.length; delLine++) {
                    var delRecord = record.delete({
                        type: 'customrecord_lmry_transactions_fields',
                        id: result_tax[delLine].getValue('internalid'),
                    });
                } // Eliminacion de Records

            }

        }

        function ECsetAmounts(RecordID) {

            var recordObj = record.load({
                type: 'creditmemo',
                id: RecordID
            });

            var jsonAmounts = {
                'gross': {
                    'field': 'custrecord_lmry_ec_gross_amount',
                    'amount': 0
                },
                'tax': {
                    'field': 'custrecord_lmry_ec_tax_amount',
                    'amount': 0
                },
                'net': {
                    'field': 'custrecord_lmry_ec_net_amount',
                    'amount': 0
                }
            };
            var jsonLineAMounts = {};

            var cItems = recordObj.getLineCount({
                sublistId: 'item'
            });

            if (cItems > 0) {
                for (var i = 0; i < cItems; i++) {
                    var netAmount = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    });
                    var grossAmount = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: i
                    });
                    var taxAmount = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'tax1amt',
                        line: i
                    });

                    jsonAmounts['gross']['amount'] += parseFloat(grossAmount);
                    jsonAmounts['net']['amount'] += parseFloat(netAmount);
                    jsonAmounts['tax']['amount'] += parseFloat(taxAmount);

                    var applyWHT = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_lmry_apply_wht_tax',
                        line: i
                    });
                    var catalog = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_lmry_ec_concept_ret',
                        line: i
                    });
                    var lineUniqueKey = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'lineuniquekey',
                        line: i
                    });
                    var taxLine = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_4601_witaxline',
                        line: i
                    });
                    var itemType = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemtype',
                        line: i
                    });
                    var item = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });
                    var itemText = recordObj.getSublistText({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    jsonLineAMounts[i] = {
                        'gross': grossAmount,
                        'tax': taxAmount,
                        'net': netAmount,
                        'applywht': applyWHT,
                        'catalog': catalog,
                        'lineuniquekey': lineUniqueKey,
                        'taxline': taxLine,
                        'itemtype': itemType,
                        'item': item,
                        'itemtext': itemText
                    };

                }
            }

            var searchEC = search.create({
                type: 'customrecord_lmry_ec_transaction_fields',
                filters: [{
                    name: 'custrecord_lmry_ec_related_transaction',
                    operator: 'is',
                    values: RecordID
                }, {
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                }]
            });
            searchEC = searchEC.run().getRange(0, 1);

            if (searchEC && searchEC.length) {
                var ecTransaction = record.load({
                    type: 'customrecord_lmry_ec_transaction_fields',
                    id: searchEC[0].id
                });
            } else {
                var ecTransaction = record.create({
                    type: 'customrecord_lmry_ec_transaction_fields'
                });
            }

            ecTransaction.setValue('custrecord_lmry_ec_related_transaction', RecordID);
            ecTransaction.setValue('custrecord_lmry_ec_lines_amount', JSON.stringify(jsonLineAMounts));

            for (var i in jsonAmounts) {
                ecTransaction.setValue(jsonAmounts[i]['field'], jsonAmounts[i]['amount']);
            }

            ecTransaction.save({
                disableTriggers: true,
                ignoreMandatoryFields: true
            });


        }

        function setBRDiscountAmount(recordObj) {
            var numberItems = recordObj.getLineCount({
                sublistId: "item"
            });
            if (numberItems) {
                var discountAmount = 0.00,
                    currentItemLine = -1;
                for (var i = 0; i < numberItems; i++) {
                    var typeDiscount = recordObj.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_lmry_col_sales_type_discount",
                        line: i
                    });
                    if (typeDiscount) {
                        if (Number(typeDiscount) == 1) {
                            var amount = recordObj.getSublistValue({
                                sublistId: "item",
                                fieldId: "amount",
                                line: i
                            }) || 0.00;
                            discountAmount += parseFloat(amount);
                        }
                    } else {
                        if (currentItemLine != -1) {
                            recordObj.setSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_lmry_col_sales_discount",
                                value: Math.abs(discountAmount),
                                line: currentItemLine
                            });
                        }
                        currentItemLine = i;
                        discountAmount = 0.00;
                    }
                }

                if (currentItemLine != -1 && discountAmount) {
                    recordObj.setSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_lmry_col_sales_discount",
                        value: Math.abs(discountAmount),
                        line: currentItemLine
                    });
                }
            }
        }

        function setearFolioCO(recordCreditMemo) {
            try {
                //Seteo de Folio Fiscal (Invoice) en el campo Folio Fiscal Ref (Credit Memo)
                var type_transaction = recordCreditMemo.type;
                var idTrans = '';
                var cont = 0;

                idTrans = recordCreditMemo.getValue('createdfrom');

                if (idTrans != '' && idTrans != null) {
                    var invoiceID = '';
                    var type = search.lookupFields({
                        type: "transaction",
                        id: idTrans,
                        columns: ['type', 'createdfrom', 'createdfrom.type']
                    });

                    if (type.type[0].value == 'CustInvc') {
                        invoiceID = idTrans;
                    } else if (type.type[0].value == 'RtnAuth' && type['createdfrom'][0]) {
                        var createdFrom = '';
                        createdFrom = type['createdfrom.type'][0].value;
                        invoiceID = type['createdfrom'][0].value;

                        if (createdFrom != 'CustInvc') {
                            return false;
                        }
                    } else {
                        return false;
                    }

                    if (invoiceID != '') {
                        var dataInvoice = search.lookupFields({
                            type: 'invoice',
                            id: invoiceID,
                            columns: ['custbody_lmry_foliofiscal']
                        });

                        var document_folio_ref = dataInvoice.custbody_lmry_foliofiscal;
                        if (document_folio_ref != null && document_folio_ref != '') {
                            recordCreditMemo.setValue('custbody_lmry_foliofiscal_doc_ref', document_folio_ref);
                        }
                    }
                }

            } catch (err) {
                log.error('setearFolioCO', err);
            }
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });
