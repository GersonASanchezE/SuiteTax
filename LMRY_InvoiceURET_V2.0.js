/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for Transaction Invoice                        ||
||                                                              ||
||  File Name: LMRY_InvoiceURET_V2.0.js                         ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(['./Latam_Library/LMRY_UniversalSetting_LBRY', './Latam_Library/LMRY_HideView3LBRY_V2.0',
    './Latam_Library/LMRY_BoletoBancarioLBRY_V2.0', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
    './Latam_Library/LMRY_libNumberInWordsLBRY_V2.0', './Latam_Library/LMRY_libRedirectAccountsLBRY_V2.0',
    './Latam_Library/LMRY_libWhtValidationLBRY_V2.0', './WTH_Library/LMRY_TAX_TransactionLBRY_V2.0',
    './WTH_Library/LMRY_AutoPercepcionDesc_LBRY_V2.0', './Latam_Library/LMRY_GLImpact_LBRY_V2.0',
    './WTH_Library/LMRY_Country_WHT_Lines_LBRY_V2.0', './Latam_Library/LMRY_ExchangeRate_LBRY_V2.0', './WTH_Library/LMRY_TAX_Withholding_LBRY_V2.0',
    'N/currency', 'N/runtime', 'N/record', 'N/search', 'N/log', 'N/config', 'N/ui/serverWidget', './WTH_Library/LMRY_RetencionesEcuador_LBRY',
    './WTH_Library/LMRY_Setup_Copy_Sublist_LBRY', './WTH_Library/LMRY_TransferIva_LBRY', './WTH_Library/LMRY_ST_Tax_TransactionLBRY_V2.0',
    './WTH_Library/LMRY_ST_Tax_Withholding_LBRY_V2.0', './Latam_Library/LMRY_CL_ST_Transaction_Sales_LBRY_V2.0',
    './WTH_Library/LMRY_EC_BaseAmounts_TaxCode_LBRY', './Latam_Library/LMRY_BR_ValidateDuplicate_LBRY_V2.0',
    './Latam_Library/LMRY_CO_Duplicate_Credit_Memos_LBRY_V2.0', 'N/cache', './WTH_Library/LMRY_New_Country_WHT_Lines_LBRY',
    './Latam_Library/LMRY_MX_ST_Sales_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_PE_MapAndSaveFields_LBRY_v2.0',
    './Latam_Library/LMRY_CO_ST_Sales_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_CO_ST_Invoice_WHT_Lines_LBRY_V2.0',
    './Latam_Library/LMRY_SV_ST_Sales_Tax_Transaction_LBRY_V2.0'
],

    function (library_Uni_Setting, library_hideview3, Library_BoletoBancario, Library_Mail, Library_Number,
        Library_Accounts, Library_Validation, Library_WHT_Transaction, Library_AutoPercepcionDesc,
        libraryGLImpact, libWHTLines, library_ExchRate, Library_Tax_WHT, currency, runtime, record, search, log, config, serverWidget,
        Library_RetencionesEcuador, Library_CopySublist, LibraryTransferIva, ST_Library_Transaction, ST_Library_Withholding,
        ST_Library_Transaction_CL, libraryEcBaseAmounts, Library_BRDup, Library_Duplicate, cache, libNewWHTLines,
        MX_ST_TaxLibrary, PE_libMapTransactions, CO_ST_TaxLibrary, CO_ST_WhtLibrary_Lines, SV_ST_TaxLibrary) {

        /**
         * Variable Universal del Registro personalizado
         */

        var LMRY_script = 'LatamReady - Invoice URET V2.0';
        var OBJ_FORM = '';
        var RCD_OBJ = '';
        var RCD = '';
        var licenses = [];
        var flag_uni_set = false;
        var statusError = false;

        var FIELD = '';

        // SuiteTax Feature
        var ST_FEATURE = false;

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

                // Obtiene la interface que se esta ejecutando
                var type_interface = runtime.executionContext;
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                RCD_OBJ = scriptContext.newRecord;
                OBJ_FORM = scriptContext.form;

                var LMRY_countr = new Array();
                var country = new Array();
                country[0] = '';
                country[1] = '';
                var subsidiary = RCD_OBJ.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = Library_Mail.getLicenses(subsidiary);
                if (licenses == null || licenses == '') {
                    licenses = [];
                    library_hideview3.PxHide(OBJ_FORM, '', RCD_OBJ.type);
                    library_hideview3.PxHideSubTab(OBJ_FORM, '', RCD_OBJ.type);
                    library_hideview3.PxHideColumn(OBJ_FORM, '', RCD_OBJ.type);
                }

                if (scriptContext.type == 'create' || scriptContext.type == 'copy') {

                    var companyInformation = config.load({
                        type: config.Type.COMPANY_INFORMATION
                    });

                    var baseCurrency = companyInformation.getValue({
                        fieldId: 'basecurrency'
                    });

                    // var url_universal = url.resolveScript({
                    //   scriptId: 'customscript_lmry_exrate_ws_stlt',
                    //   deploymentId: 'customdeploy_lmry_exrate_ws_stlt'
                    // });

                    var lmry_basecurrency = OBJ_FORM.addField({
                        id: 'custpage_lmry_basecurrency',
                        label: 'Latam - Base Currency',
                        type: serverWidget.FieldType.TEXT
                    }).defaultValue = baseCurrency;

                    var lmry_exchange_rate = OBJ_FORM.addField({
                        id: 'custpage_lmry_exchange_rate',
                        label: 'Latam - Exchange Rate',
                        type: serverWidget.FieldType.SELECT
                    });

                    // var lmry_basecurrency_url = OBJ_FORM.addField({
                    //   id: 'custpage_lmry_basecurrency_url',
                    //   label: 'Latam - Base Currency Url',
                    //   type: serverWidget.FieldType.INLINEHTML
                    // }).defaultValue = '<script> var webservice_url_base_currency = "' + url_universal + '"</script>';

                    OBJ_FORM.insertField({
                        field: lmry_exchange_rate,
                        nextfield: 'currency'
                    });
                }

                if (scriptContext.type != 'print' && scriptContext.type != 'email') {

                    if (scriptContext.type == 'create') {
                        OBJ_FORM.addField({
                            id: 'custpage_uni_set_status',
                            label: 'Set Estatus',
                            type: serverWidget.FieldType.CHECKBOX
                        }).defaultValue = 'F';
                    }

                }

                if (scriptContext.type != 'print' && scriptContext.type != 'email') {
                    try {

                        var subsidiari = RCD_OBJ.getValue({
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

                    if (OBJ_FORM != '' && OBJ_FORM != null) {
                        var hide_transaction = Library_Mail.getHideView(country, 2, licenses);
                        var hide_sublist = Library_Mail.getHideView(country, 5, licenses);
                        var hide_column = Library_Mail.getHideView(country, 3, licenses);

                        if (Library_Mail.getCountryOfAccess(country, licenses)) {
                            if (hide_transaction == true) {
                                library_hideview3.PxHide(OBJ_FORM, country[0], RCD_OBJ.type);
                            }
                            if (hide_sublist == true) {
                                library_hideview3.PxHideSubTab(OBJ_FORM, country[0], RCD_OBJ.type);
                            }
                            if (hide_column == true) {
                                library_hideview3.PxHideColumn(OBJ_FORM, country[0], RCD_OBJ.type);
                            }
                        } else {
                            if (hide_transaction == true) {
                                library_hideview3.PxHide(OBJ_FORM, '', RCD_OBJ.type);
                            }
                            if (hide_sublist == true) {
                                library_hideview3.PxHideSubTab(OBJ_FORM, '', RCD_OBJ.type);
                            }
                            if (hide_column == true) {
                                library_hideview3.PxHideColumn(OBJ_FORM, '', RCD_OBJ.type);
                            }
                        }
                    }
                }


                if (scriptContext.type != 'print' && scriptContext.type != 'email') {

                    // Valida que tenga acceso

                    var LMRY_Result = ValidateAccessInv(RCD_OBJ.getValue({
                        fieldId: 'subsidiary'
                    }), OBJ_FORM, true, scriptContext.type);

                    // SuiteTax
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
                                    ST_Library_Transaction_CL.cleanLinesforCopy(RCD_OBJ, licenses);
                                    break;
                                case "MX":
                                    MX_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                    break;
                                case "CO":
                                    CO_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                    break;
                                case "SV":
                                    SV_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                    break;
                            }
                        }

                        if (["copy", "create"].indexOf(scriptContext.type) != -1) {
                            var createdFrom = RCD_OBJ.getValue({ fieldId: "createdfrom" });
                            if (createdFrom) {
                                switch (LMRY_Result[0]) {
                                    case "CL":
                                        ST_Library_Transaction_CL.cleanLinesforCopy(RCD_OBJ, licenses);
                                        break;
                                    case "MX":
                                        MX_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                        break;
                                    case "CO":
                                        CO_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                        break;
                                    case "SV":
                                        SV_ST_TaxLibrary.deleteTaxDetailLines(RCD_OBJ);
                                        break;
                                }
                            }
                        }

                    }

                    if (LMRY_Result[0] == 'CL') {
                        if (Library_Mail.getAuthorization(414, licenses)) {
                            var fieldSerie = OBJ_FORM.getField({
                                id: 'custbody_lmry_serie_doc_cxc'
                            });

                            fieldSerie.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.NORMAL
                            });
                        }
                    }

                    // Solo para Mexico
                    if (LMRY_Result[0] == 'MX') {
                        // Lista de estado de proceso
                        var procesado = RCD_OBJ.getValue({
                            fieldId: 'custbody_lmry_schedule_transfer_of_iva'
                        });
                        // Verifica si esta procesado y si esta activo el feature de bloqueo de transaccion
                        if (procesado == 1 && Library_Mail.getAuthorization(97, licenses)) {
                            // Elimina el boton de edicion
                            scriptContext.form.removeButton('edit');
                        }

                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(289, licenses)) {
                            library_ExchRate.createFieldURET(scriptContext, serverWidget);
                        }
                    }

                    if (LMRY_Result[0] == 'BR') {
                        //Si se copia la transaccion. Se limpian los valores para calculo de impuesto BR.
                        if (scriptContext.type == 'copy' || scriptContext.type == 'xcopy') {
                            if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                ST_Library_Transaction.cleanLinesforCopy(RCD_OBJ, licenses);
                            } else {
                                Library_WHT_Transaction.cleanLinesforCopy(RCD_OBJ, licenses);
                            }
                        }

                        if (scriptContext.type == 'create' || scriptContext.type == 'copy') {

                            var createdFrom = RCD_OBJ.getValue({
                                fieldId: 'createdfrom',
                            });

                            //Si se crea una transaccion desde otra, se limpian los valores para calculo de impuesto BR.
                            if (createdFrom) {
                                if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                    ST_Library_Transaction.cleanLinesforCopy(RCD_OBJ, licenses);
                                } else {
                                    Library_WHT_Transaction.cleanLinesforCopy(RCD_OBJ, licenses);
                                }
                            }

                            if (Library_Mail.getAuthorization(321, licenses)) {
                                library_ExchRate.createFieldURET(scriptContext, serverWidget);
                            }
                        }
                    }

                    if (LMRY_Result[0] == 'CL') {
                        if (Library_Mail.getAuthorization(322, licenses)) {
                            library_ExchRate.createFieldURET(scriptContext, serverWidget);
                        }
                    }

                    if (LMRY_Result[0] == 'PE') {
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(403, licenses)) {
                            library_ExchRate.createFieldURET(scriptContext, serverWidget);
                        }
                    }

                    if (LMRY_Result[0] == 'AR') {
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(404, licenses)) {
                            library_ExchRate.createFieldURET(scriptContext, serverWidget);
                        }
                    }

                    if (LMRY_Result[0] == 'CO') {
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(409, licenses)) {
                            library_ExchRate.createFieldURET(scriptContext, serverWidget);
                        }

                        if (Library_Mail.getAuthorization(340, licenses) || Library_Mail.getAuthorization(721, licenses)) {
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
                }

                // Si es nuevo, editado o copiado
                if (scriptContext.type == 'create' || scriptContext.type == 'edit' || scriptContext.type == 'copy') {
                    if (RCD_OBJ.getValue({
                        fieldId: 'custbody_lmry_subsidiary_country'
                    }) == '') {
                        RCD_OBJ.getField({
                            fieldId: 'custbody_lmry_subsidiary_country'
                        }).isDisplay = true;

                    }
                    /* MODIFICACION DEL URET
                    Descripcion: Cuando el contexto sea un Make Copy se setea los 4 campos de Retención, los campos
                    TaxRate y TaxCode  con espacios en blanco y los campos Amount y BaseAmount con ceros.
                    Fecha:27/08/2019
                    */
                    if (scriptContext.type == 'copy') {
                        RCD_OBJ.setValue({
                            fieldId: 'custbody_lmry_wtax_code',
                            value: ''
                        });
                        RCD_OBJ.setValue({
                            fieldId: 'custbody_lmry_wtax_rate',
                            value: ''
                        })
                        RCD_OBJ.setValue({
                            fieldId: 'custbody_lmry_wtax_amount',
                            value: 0.0
                        })
                        RCD_OBJ.setValue({
                            fieldId: 'custbody_lmry_wbase_amount',
                            value: 0.0
                        })
                    } // Fin Modificacion
                }

                // Obtiene el idioma del entorno
                var featurelang = runtime.getCurrentScript().getParameter({
                    name: 'LANGUAGE'
                });
                featurelang = featurelang.substring(0, 2);

                // Lógica GL Impact
                if (scriptContext.type == 'view') {
                    var btnGl = libraryGLImpact.featureGLImpact(RCD_OBJ, 'invoice');

                    if (btnGl == 1) {
                        if (featurelang == 'es') {
                            OBJ_FORM.addButton({
                                id: 'custpage_id_button_imp',
                                label: 'IMPRIMIR GL',
                                functionName: 'onclick_event_gl_impact()'
                            });
                        } else {
                            OBJ_FORM.addButton({
                                id: 'custpage_id_button_imp',
                                label: 'PRINT GL',
                                functionName: 'onclick_event_gl_impact()'
                            });
                        }
                        OBJ_FORM.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
                    }

                    // CO - Print withholdings in GL Impact	(09.11.2020)
                    if (Library_Mail.getAuthorization(552, licenses)) {
                        var whtamount = parseFloat(RCD_OBJ.getValue({
                            fieldId: 'custbody_lmry_co_reteica_amount'
                        })) +
                            parseFloat(RCD_OBJ.getValue({
                                fieldId: 'custbody_lmry_co_reteiva_amount'
                            })) +
                            parseFloat(RCD_OBJ.getValue({
                                fieldId: 'custbody_lmry_co_retefte_amount'
                            })) +
                            parseFloat(RCD_OBJ.getValue({
                                fieldId: 'custbody_lmry_co_retecree_amount'
                            }));
                        if (whtamount > 0) {
                            if (featurelang == 'es') {
                                OBJ_FORM.addButton({
                                    id: 'custpage_id_button_imp',
                                    label: 'CO-IMPRIMIR GL WHT',
                                    functionName: 'onclick_event_co_wht_gl_impact()'
                                });
                            } else {
                                OBJ_FORM.addButton({
                                    id: 'custpage_id_button_imp',
                                    label: 'CO-PRINT GL WHT',
                                    functionName: 'onclick_event_co_wht_gl_impact()'
                                });
                            }
                            OBJ_FORM.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
                        }
                    }
                }



                if (scriptContext.type != 'print' && scriptContext.type != 'email') {

                    var createdFrom = RCD_OBJ.getValue('createdfrom');

                    //SETEO DEL CUSTBODY LATAMREADY - BR TRANSACTION TYPE PARA FILTRAR LA COLUMNA CFOP
                    if (LMRY_Result[0] == 'BR' && LMRY_Result[2] == true && (scriptContext.type == 'create' || scriptContext.type == 'edit' || scriptContext.type == 'copy')) {
                        var transactionType = RCD_OBJ.getValue('custbody_lmry_br_transaction_type');
                        if (!transactionType || createdFrom) {
                            var typeStandard = RCD_OBJ.getValue('type');
                            if (typeStandard) {
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
                                if (resultTransactionType && resultTransactionType.length) {
                                    RCD_OBJ.setValue('custbody_lmry_br_transaction_type', resultTransactionType[0].getValue('internalid'));

                                }

                            }
                        }
                    } //FIN BR CFOP

                    //CL CHANGE CURRENCY UF: SOLO TRANSFORM Y MAKE COPY
                    if (LMRY_Result[0] == 'CL' && Library_Mail.getAuthorization(604, licenses) && ((scriptContext.type == 'create' && createdFrom) || scriptContext.type == 'copy')) {

                        var searchCurrencies = search.create({
                            type: 'currency',
                            columns: ['symbol', 'internalid', 'name'],
                            filters: [{
                                name: 'isinactive',
                                operator: 'is',
                                values: 'F'
                            }]
                        });

                        searchCurrencies = searchCurrencies.run().getRange(0, 1000);

                        var jsonCurrencies = {};
                        var fieldRateUF = '';

                        for (var i = 0; i < searchCurrencies.length; i++) {
                            var idCurrency = searchCurrencies[i].getValue('internalid');
                            var name = searchCurrencies[i].getValue('name');
                            var symbol = searchCurrencies[i].getValue('symbol');
                            symbol = symbol.toUpperCase();

                            jsonCurrencies[idCurrency] = {
                                'symbol': symbol,
                                'name': name
                            };

                        }

                        var searchSetupTax = search.create({
                            type: 'customrecord_lmry_setup_tax_subsidiary',
                            columns: ['custrecord_lmry_setuptax_cl_rate_uf'],
                            filters: [{
                                name: 'isinactive',
                                operator: 'is',
                                values: 'F'
                            }, {
                                name: 'custrecord_lmry_setuptax_subsidiary',
                                operator: 'is',
                                values: subsidiary
                            }]
                        });

                        searchSetupTax = searchSetupTax.run().getRange(0, 1);

                        if (searchSetupTax && searchSetupTax.length && searchSetupTax[0].getValue('custrecord_lmry_setuptax_cl_rate_uf')) {
                            fieldRateUF = searchSetupTax[0].getValue('custrecord_lmry_setuptax_cl_rate_uf');
                        }

                        var currencyTransaction = RCD_OBJ.getValue('currency');
                        var tranDate = RCD_OBJ.getValue('trandate');

                        if (jsonCurrencies[currencyTransaction]['symbol'] == 'CLP' && fieldRateUF && RCD_OBJ.getField(fieldRateUF)) {

                            var rateUF = currency.exchangeRate({
                                source: 'CLF',
                                target: 'CLP',
                                date: tranDate
                            });
                            RCD_OBJ.setValue({
                                fieldId: fieldRateUF,
                                value: parseFloat(rateUF),
                                ignoreFieldChange: true
                            });

                            for (var i = 0; i < RCD_OBJ.getLineCount({
                                sublistId: 'item'
                            }); i++) {

                                var amountUF = RCD_OBJ.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_prec_unit_so',
                                    line: i
                                });
                                var quantity = RCD_OBJ.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    line: i
                                });

                                if (parseFloat(amountUF) > 0 && parseFloat(rateUF) > 0) {

                                    amountUF = parseFloat(amountUF) * parseFloat(rateUF);
                                    amountUF = parseFloat(amountUF).toFixed(0);

                                    RCD_OBJ.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        line: i,
                                        value: amountUF
                                    });

                                    amountUF = parseFloat(quantity) * parseFloat(amountUF);

                                    RCD_OBJ.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'amount',
                                        line: i,
                                        value: amountUF
                                    });

                                }

                            }


                        }

                    } //FIN CL CHANGE CURRENCY

                    //BOTON MAP REDUCE RETENCION CO
                    if (ST_FEATURE == false || ST_FEATURE == "F") {
                        if (LMRY_Result[0] == 'CO' && Library_Mail.getAuthorization(340, licenses) && scriptContext.type == 'view') {
                            libNewWHTLines.beforeLoad(RCD_OBJ, OBJ_FORM, scriptContext, 'customer');
                        }// Fin Boton CO Lineas
                    }


                }


                //Universal Setting
                var field_createdfrom = RCD_OBJ.getField('createdfrom');
                var value_createdfrom = '';

                if (field_createdfrom != '' && field_createdfrom != null) {
                    value_createdfrom = RCD_OBJ.getValue('createdfrom');
                }

            } catch (err) {
                log.error('err', err);
            }
            return true;
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

                ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

                // Sale del proceso si es MAPREDUCE
                var type_interface = runtime.executionContext;
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                var ORCD = scriptContext.oldRecord;
                var RCD = scriptContext.newRecord;
                var subsidiary = RCD.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = Library_Mail.getLicenses(subsidiary);

                var LMRY_Result = ValidateAccessInv(RCD.getValue({
                    fieldId: 'subsidiary'
                }), RCD, false, scriptContext.type);
                // Tipo de evento del users events
                var type_event = scriptContext.type;
                //Universal Setting se realiza solo al momento de crear
                if (type_event == 'create' && (type_interface == 'USERINTERFACE' || type_interface == 'USEREVENT' || type_interface == 'CSVIMPORT')) {

                    var type_document = RCD.getValue('custbody_lmry_document_type');

                    if (library_Uni_Setting.auto_universal_setting(licenses, false)) {
                        //Solo si el campo LATAM - LEGAL DOCUMENT TYPE se encuentra vacío
                        if (type_interface == 'USERINTERFACE') {
                            if (RCD.getValue('custpage_uni_set_status') == 'F' && (type_document == '' || type_document == null)) {
                                //Seteo campos cabecera, numero pre impreso y template
                                library_Uni_Setting.automatic_setfield(RCD, false);
                                library_Uni_Setting.set_preimpreso(RCD, LMRY_Result, licenses);
                                library_Uni_Setting.set_template(RCD, licenses);
                                RCD.setValue('custpage_uni_set_status', 'T');
                            }

                        } else if (type_interface == 'CSVIMPORT' || type_interface == 'USEREVENT') {
                            var check_csv = RCD.getValue('custbody_lmry_scheduled_process');
                            //Check box para controlar el seteo automático en el record anexado
                            if ((check_csv == false || check_csv == 'F') && (type_document == '' || type_document == null)) {
                                //Seteo campos cabecera, numero pre impreso y template
                                library_Uni_Setting.automatic_setfield(RCD, false);
                                library_Uni_Setting.set_preimpreso(RCD, LMRY_Result, licenses);
                                library_Uni_Setting.set_template(RCD, licenses);

                                if (check_csv == 'F') {
                                    RCD.setValue('custbody_lmry_scheduled_process', 'T');
                                } else {
                                    RCD.setValue('custbody_lmry_scheduled_process', true);
                                }
                            }
                        }
                        //Seteo de campos perteneciente a record anexado
                        library_Uni_Setting.set_inv_identifier(RCD);
                    }
                }

                // Diferente de Eliminacion
                if (scriptContext.type != 'delete') {
                    // Para todos los paises que tengan acceso
                    log.debug('LMRY_Result', LMRY_Result);
                    if (LMRY_Result[2] == true && LMRY_Result[3] == true && RCD.getValue({
                        fieldId: 'memo'
                    }) != 'VOID') {
                        // Validamos que no este vacio
                        var currency = RCD.getValue({
                            fieldId: 'currency'
                        });
                        if (currency == '' || currency == null) {
                            return true;
                        }

                        // Buscamos el nombre y simbolo de la moneda
                        // var monedaTexto = nlapiLookupField('currency', currency, ['name', 'symbol']);
                        var monedaTexto = search.lookupFields({
                            type: search.Type.CURRENCY,
                            id: currency,
                            columns: ['name', 'symbol']
                        });
                        var mon_name = monedaTexto.name;
                        var mon_symb = monedaTexto.symbol;

                        // Importe total de la transaccion
                        var imptotal = RCD.getValue({
                            fieldId: 'total'
                        });

                        // Convertimos el monto en letras
                        var impletras = '';
                        switch (LMRY_Result[0]) {
                            case 'PA':
                                impletras = Library_Number.ConvNumeroLetraESP(imptotal, '', '', 'Y');
                                break;
                            case 'PY':
                                imptotal = parseFloat(RCD.getValue({
                                    fieldId: 'total'
                                }));
                                impletras = Library_Number.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'Y');
                                break;
                            case 'CO':
                                imptotal = parseFloat(RCD.getValue({
                                    fieldId: 'total'
                                }));

                                impletras = Library_Number.ConvNumeroLetraESP(imptotal, mon_name, mon_symb, 'Y');
                                RCD.setValue({
                                    fieldId: 'custbody_lmry_co_monto_letras',
                                    value: impletras
                                });

                                break;
                            case 'SV':
                                //  Se obtiene el id de la moneda
                                var tipoMoneda = RCD.getValue('currency');

                                //  Se realiza la busqueda de los campos symbol y name por el id de la moneda
                                var mon_symb = search.lookupFields({
                                    type: 'currency',
                                    id: tipoMoneda,
                                    columns: ['symbol']
                                });
                                var mon_name = search.lookupFields({
                                    type: 'currency',
                                    id: tipoMoneda,
                                    columns: ['name']
                                });

                                // Restamos el custbody_lmry_wtax_wamt al monto Total por que NS despues de grabar el documento recien le
                                // Aplica la retencion.
                                var imptotal = 0.00;

                                imptotal = parseFloat(RCD.getValue('total')) - parseFloat(RCD.getValue('custbody_lmry_wtax_wamt'));

                                imptotal = imptotal.toFixed(2);

                                // Monto en Letras Parametros: Importe, Moneda, Simbolo y concadenador

                                var impletras = Library_Number.ConvNumeroLetraESP(imptotal, mon_name.name, mon_symb.symbol, 'CON');
                                //  log.debug('impletras 1',impletras);
                                RCD.setValue({
                                    fieldId: 'custbody_lmry_pa_monto_letras',
                                    value: impletras
                                });
                                break;
                            default:
                                impletras = Library_Number.ConvNumeroLetraESP(imptotal, mon_name, '', 'Y');
                                break;
                        }
                        //log.debug('impletras 2',impletras);

                        // Monto en Lentras menos Colombia y El Salvador
                        if (LMRY_Result[0] != 'CO' && LMRY_Result[0] != 'SV') {
                            RCD.setValue({
                                fieldId: 'custbody_lmry_pa_monto_letras',
                                value: impletras
                            });
                        }

                        /*************************************
                         * Auto Percepcions para Argentina,
                         * Brasil y Paraguay antes // Ahora los 14 paises
                         *************************************/
                        var swAutoPe = false;
                        if (LMRY_Result[0] == 'AR') {
                            swAutoPe = Library_Mail.getAuthorization(142, licenses);
                        }
                        if (LMRY_Result[0] == 'BR') {
                            swAutoPe = Library_Mail.getAuthorization(143, licenses);
                        }
                        if (LMRY_Result[0] == 'BO') {
                            swAutoPe = Library_Mail.getAuthorization(230, licenses);
                        }
                        if (LMRY_Result[0] == 'PE') {
                            swAutoPe = Library_Mail.getAuthorization(231, licenses);
                        }
                        if (LMRY_Result[0] == 'CL') {
                            swAutoPe = Library_Mail.getAuthorization(232, licenses);
                        }
                        if (LMRY_Result[0] == 'CO') {
                            swAutoPe = Library_Mail.getAuthorization(233, licenses);
                        }
                        if (LMRY_Result[0] == 'CR') {
                            swAutoPe = Library_Mail.getAuthorization(234, licenses);
                        }
                        if (LMRY_Result[0] == 'EC') {
                            swAutoPe = Library_Mail.getAuthorization(235, licenses);
                        }
                        if (LMRY_Result[0] == 'SV') {
                            swAutoPe = Library_Mail.getAuthorization(236, licenses);
                        }
                        if (LMRY_Result[0] == 'GT') {
                            swAutoPe = Library_Mail.getAuthorization(237, licenses);
                        }
                        if (LMRY_Result[0] == 'MX') {
                            swAutoPe = Library_Mail.getAuthorization(238, licenses);
                        }
                        if (LMRY_Result[0] == 'PA') {
                            swAutoPe = Library_Mail.getAuthorization(239, licenses);
                        }
                        if (LMRY_Result[0] == 'PY') {
                            swAutoPe = Library_Mail.getAuthorization(240, licenses);
                        }
                        if (LMRY_Result[0] == 'UY') {
                            swAutoPe = Library_Mail.getAuthorization(241, licenses);
                        }

                        // Si hay acceso Procesa
                        if (swAutoPe) {
                            // Realiza el seteo de percepciones
                            Library_AutoPercepcionDesc.autoperc_beforeSubmit(scriptContext, LMRY_Result[0], scriptContext.type);
                        }

                    }
                }

                //NUEVO CASO RETENCIONES ECUADOR
                if (LMRY_Result[0] == 'EC' && Library_Mail.getAuthorization(153, licenses) == true) {
                    Library_RetencionesEcuador.beforeSubmitTransaction(scriptContext, LMRY_Result, scriptContext.type);
                }

                var exchrate = false;
                switch (LMRY_Result[0]) {
                    case 'AR':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(404, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'BR':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(321, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CO':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(409, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CL':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(322, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'MX':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(289, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'PE':
                        if ((scriptContext.type == 'create' || scriptContext.type == 'copy') && Library_Mail.getAuthorization(403, licenses)) {
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
                if (ST_FEATURE == false || ST_FEATURE == "F") {
                    if (LMRY_Result[0] == 'CO') {
                        if (Library_Mail.getAuthorization(721, licenses) == true && scriptContext.type == 'edit') {
                            RCD.setValue('custbody_lmry_scheduled_process', false);
                        }
                        libNewWHTLines.beforeSubmitTransaction(scriptContext, licenses);
                    } else {
                        libWHTLines.beforeSubmitTransaction(scriptContext, licenses);
                    }
                }

                // Nueva logica de Colombia
                if (LMRY_Result[0] == 'BR') {
                    if (Library_Mail.getAuthorization(147, licenses) == true) {
                        Library_WHT_Transaction.beforeSubmitTransaction(scriptContext);
                    }
                }

                // if (scriptContext.type == 'delete') {
                //   if (LMRY_Result[0] == 'BR' && Library_Mail.getAuthorization(416, licenses)) {
                //     Library_Tax_WHT.deleteGeneratedRecords(RCD);
                //   }
                // }

                if (scriptContext.type == 'delete') {

                    // SuiteTax
                    var LMRY_Intern = RCD.id;
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
                                if (Library_Mail.getAuthorization(340, licenses) == true) {
                                    CO_ST_WhtLibrary_Lines.deleteRelatedRecords(RCD.id, "invoice");
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
                        setBRDiscountAmount(RCD);
                    }

                    if (scriptContext.type == "delete") {
                        if (Library_Mail.getAuthorization(416, licenses)) {
                            Library_Tax_WHT.deleteGeneratedRecords(RCD, scriptContext.type);
                        }
                    }
                }

                //SETEO DE CAMPOS BASE 0%, 12% Y 14%
                var eventsEC = ['create', 'copy', 'edit'];
                if (LMRY_Result[0] == 'EC' && Library_Mail.getAuthorization(42, licenses) && eventsEC.indexOf(scriptContext.type) != -1) {
                    libraryEcBaseAmounts.setBaseAmounts(RCD, '2');
                }

                if (LMRY_Result[0] == "CO" && Library_Mail.getAuthorization(666, licenses) && scriptContext.type == 'edit' && type_interface != 'USERINTERFACE') {

                    //feature cabecera
                    if (Library_Mail.getAuthorization(27, licenses)) {
                        var rete_change_wht = Library_Duplicate.Verification_Duplicate_Fields(Library_Duplicate.Old_Values_WHT(ORCD), RCD);
                        var lines_change = Library_Duplicate.Verification_Duplicate_Lines(RCD, ORCD);
                        if (Library_Duplicate.Validate_EIDocument(RCD) && (rete_change_wht || lines_change)) {
                            statusError = true;
                        }
                    }

                    //if feature lineas
                    if (Library_Mail.getAuthorization(340, licenses)) {
                        var lines_change = Library_Duplicate.Verification_Duplicate_Lines(RCD, ORCD);
                        if (Library_Duplicate.Validate_EIDocument(RCD) && lines_change) {
                            statusError = true;
                        }
                    }
                }

            } catch (err) {
                RCD_OBJ = scriptContext.newRecord;
                Library_Mail.sendemail2(' [ InvUret_BeforeSubmit ] ' + err, LMRY_script, RCD_OBJ, 'tranid', 'entity');
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

                ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });
                // Sale del proceso si es MAPREDUCE
                var type_interface = runtime.executionContext;
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                var ORCD = scriptContext.oldRecord;
                var RCD = scriptContext.newRecord;
                var subsidiary = RCD.getValue({
                    fieldId: 'subsidiary'
                });
                licenses = Library_Mail.getLicenses(subsidiary);
                var LMRY_Intern = scriptContext.newRecord.id;

                // Validacion de Acceso
                var LMRY_Result = ValidateAccessInv(RCD.getValue({
                    fieldId: 'subsidiary'
                }),
                    RCD, false,
                    scriptContext.type);

                // Tipo de evento del users events
                var type_event = scriptContext.type;

                //Universal Setting se realiza solo al momento de crear
                if (type_event == 'create' && (type_interface == 'USERINTERFACE' || type_interface == 'USEREVENT' || type_interface == 'CSVIMPORT')) {
                    var type_document = RCD.getValue('custbody_lmry_document_type');

                    if (type_interface == 'USERINTERFACE') {
                        //Mediante el custpage se conoce que el seteo de cabecera fue realizado por Universal Setting
                        if (RCD.getValue('custpage_uni_set_status') == 'T') {
                            //Seteo de campos perteneciente a record anexado
                            library_Uni_Setting.automatic_setfieldrecord(RCD);
                        }
                    } else if (type_interface == 'CSVIMPORT' || type_interface == 'USEREVENT') {
                        //Mediante el siguiente campo se conoce si seteo de cabecera fue realizado por Universal Setting
                        var check_csv = RCD.getValue('custbody_lmry_scheduled_process');

                        if (check_csv == 'T' || check_csv == true) {
                            //Seteo de campos perteneciente a record anexado
                            library_Uni_Setting.automatic_setfieldrecord(RCD);

                            if (type_interface == 'CSVIMPORT') {
                                //Cálculo de impuestos para BR inventario
                                library_Uni_Setting.tax_calculator(RCD);
                            }

                            if (check_csv == 'T') {
                                RCD.setValue('custbody_lmry_scheduled_process', 'F');
                            } else {
                                RCD.setValue('custbody_lmry_scheduled_process', false);
                            }
                        }
                    }
                }

                // Solo si la transaccion es Eliminada
                if (scriptContext.type == 'delete') {
                    afterSubmit_delete(LMRY_Result, LMRY_Intern);
                }

                // Solo si la transaccion es Creada y/o Editada
                if (scriptContext.type == 'create' || scriptContext.type == 'edit') {
                    afterSubmit_newedi(RCD, scriptContext, LMRY_Result, ORCD);
                }

                // Solo si la transaccion es Creada, Editada y/o Copiada
                if (scriptContext.type == 'create' || scriptContext.type == 'edit' || scriptContext.type == 'copy') {
                    if (LMRY_Result[0] == 'MX' && Library_Mail.getAuthorization(243, licenses) == true) {
                        LibraryTransferIva.generateMXTransField(scriptContext);
                    }
                }

                // Solo si la transaccion es Creada y/o Editada
                if (scriptContext.type == 'create' || scriptContext.type == 'edit' || scriptContext.type == 'copy') {
                    var transactionType = 'invoice';
                    if (ST_FEATURE == false || ST_FEATURE == "F") {
                        if (LMRY_Result[0] == 'CO') {
                            var flagEntity = libNewWHTLines.searchEntity(RCD.getValue('entity'), 'customer');

                            if (!flagEntity) {
                                libNewWHTLines.newAfterSubmitTransaction(scriptContext, type_event, LMRY_Intern, transactionType, licenses, false);
                            }

                        } else {
                            libWHTLines.afterSubmitTransaction(scriptContext, type_event, LMRY_Intern, transactionType, licenses);
                        }
                    }

                }

                // Nueva logica de colombia
                if (LMRY_Result[0] == 'BR') {

                    if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {
                        if ('create' == scriptContext.type) {
                            Library_BRDup.assignPreprinted(RCD, licenses);
                        }
                        if (Library_Mail.getAuthorization(416, licenses)) {
                            Library_Tax_WHT.deleteGeneratedRecords(RCD);
                        }

                        var recordBR = RCD;

                        recordBR = record.load({
                            type: "invoice",
                            id: RCD.id
                        });

                        //Calculo de impuestos - servicios
                        if (Library_Mail.getAuthorization(147, licenses) == true) {
                            var context = {
                                type: scriptContext.type,
                                newRecord: recordBR
                            };
                            if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                ST_Library_Transaction.afterSubmitTransaction(context, true);
                                recordBR.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            } else {
                                Library_WHT_Transaction.afterSubmitTransaction(context, true);
                                recordBR.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            }
                        }

                        updateInstallments(recordBR);

                        //Retenciones
                        if (Library_Mail.getAuthorization(416, licenses)) {
                            if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                ST_Library_Withholding.LatamTaxWithHoldingBR(recordBR, scriptContext.type);
                            } else {
                                Library_Tax_WHT.LatamTaxWithHoldingBR(recordBR, scriptContext.type);
                            }
                        }

                        //boleto bancario
                        var urlboleto = Library_BoletoBancario.obtenerURLPdfBoletoBancario(LMRY_Intern, 1, 1);

                    }
                }

                // LatamTax - SuiteTax
                if (["create", "edit", "copy"].indexOf(scriptContext.type) != -1) {

                    if (ST_FEATURE == true || ST_FEATURE == "T") {

                        var ST_RecordObj = record.load({
                            type: "invoice",
                            id: RCD.id
                        });

                        var ST_Context = {
                            type: scriptContext.type,
                            newRecord: ST_RecordObj
                        };

                        switch (LMRY_Result[0]) {

                            case "CL":
                                if (Library_Mail.getAuthorization(606, licenses) == true) {
                                    ST_Library_Transaction_CL.afterSubmitTransaction(ST_Context);
                                    ST_RecordObj.save({
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true,
                                        enableSourcing: true
                                    });
                                }
                                break;

                            case "MX":
                                if (Library_Mail.getAuthorization(672, licenses) == true) {
                                    MX_ST_TaxLibrary.setTaxTransaction(ST_Context);
                                    ST_RecordObj.save({
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true,
                                        enableSourcing: true,
                                    });
                                }
                                break;

                            case "CO":
                                if (Library_Mail.getAuthorization(645, licenses) == true) {
                                    CO_ST_TaxLibrary.setTaxTransaction(ST_Context);
                                    ST_RecordObj.save({ ignoreMandatoryFields: true, disableTriggers: true, enableSourcing: true });
                                }
                                if (Library_Mail.getAuthorization(340, licenses) == true) {
                                    ST_RecordObj = scriptContext.newRecord;
                                    CO_ST_WhtLibrary_Lines.setWHTLineTransaction(ST_RecordObj, scriptContext, licenses);
                                }
                                break;

                            case "SV":
                                if (Library_Mail.getAuthorization(723, licenses) == true) {
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

                //Setup Copy Sublist
                var createdFrom = RCD.getValue('createdfrom');
                if ((scriptContext.type == 'create') && (createdFrom != null && createdFrom != '') && LMRY_Result[0] == 'BR' && Library_Mail.getAuthorization(501, licenses) == true) {
                    Library_CopySublist.afterCopySublist(scriptContext);
                }


                // Se ejecuta si es diferente de eliminar
                if (scriptContext.type != 'delete') {
                    /******************************
                     * Solo para localizacion :
                     *  - Peru = PE WHT
                     *****************************/
                    try {
                        if (LMRY_Result[0] == 'PE' && type_interface != 'SUITELET' && RCD.getValue("memo") != "VOID") {
                            // Importe de retencion
                            var custpage_wth = 0;
                            // Importe total de la transaccion
                            var imptotal = RCD.getValue({
                                fieldId: 'total'
                            });

                            // Buscamos el nombre y simbolo de la moneda
                            var monedaTexto = search.lookupFields({
                                type: search.Type.CURRENCY,
                                id: RCD.getValue({
                                    fieldId: 'currency'
                                }),
                                columns: ['name', 'symbol']
                            });
                            var mon_name = monedaTexto.name;

                            // Busqueda en Custom Record : Withholding Tax Setup
                            var search_nexus = search.create({
                                type: 'nexus',
                                columns: ['internalid'],
                                filters: [{
                                    name: 'country',
                                    operator: 'is',
                                    values: 'PE'
                                }]
                            });
                            var result_nexus = search_nexus.run().getRange(0, 1);
                            if (result_nexus != null && result_nexus.length > 0) {
                                var nexus_id = result_nexus[0].getValue('internalid');
                                var search_onaccruel = search.create({
                                    type: 'customrecord_4601_witaxsetup',
                                    columns: ['custrecord_4601_wts_saletaxpoint'],
                                    filters: [{
                                        name: 'custrecord_4601_wts_nexus',
                                        operator: 'equalto',
                                        values: [nexus_id]
                                    },
                                    {
                                        name: 'custrecord_4601_wts_onsales',
                                        operator: 'is',
                                        values: 'T'
                                    },
                                    {
                                        name: 'isinactive',
                                        operator: 'is',
                                        values: 'F'
                                    }

                                    ]
                                });
                                var result_onaccruel = search_onaccruel.run().getRange(0, 1);
                                if (result_onaccruel != null && result_onaccruel.length > 0) {
                                    if (result_onaccruel[0].getValue('custrecord_4601_wts_saletaxpoint') == 'onaccrual') {
                                        // Custbody : LATAM WTAX AMOUNT
                                        custpage_wth = RCD.getValue('custbody_lmry_wtax_amount');
                                    }
                                }
                            }
                            if (imptotal != '' && imptotal != null && imptotal !== undefined &&
                                custpage_wth != '' && custpage_wth != null && custpage_wth !== undefined) {
                                var impTotal = parseFloat(imptotal) + parseFloat(custpage_wth);
                                impTotal = parseFloat(Math.round(parseFloat(impTotal) * 100) / 100);
                                var impletras = Library_Number.ConvNumeroLetraESP(impTotal, mon_name, '', 'Y');
                                var otherId = record.submitFields({
                                    type: 'invoice',
                                    id: LMRY_Intern,
                                    values: {
                                        'custbody_lmry_pa_monto_letras': impletras
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        RCD_OBJ = scriptContext.newRecord;
                        Library_Mail.sendemail2(' [ afterSubmit - WHT 4601 ] ' + err, LMRY_script, RCD_OBJ, 'tranid', 'entity');
                    }

                    /******************************
                     * Solo para localizacion :
                     *  - Brasil = BR
                     *  - Mexico = MX
                     *  - Ecuador = EC
                     *  - Uruguay = UY
                     *  - Costa Rica = CR
                     *  - Chile = CL
                     *  - Bolivia = BO
                     *  - 2021.05.17 Se agrega la logica de Peru
                     *****************************/
                    if (LMRY_Result[0] == 'BR' || LMRY_Result[0] == 'MX' || LMRY_Result[0] == 'EC' ||
                        LMRY_Result[0] == 'UY' || LMRY_Result[0] == 'CR' || LMRY_Result[0] == 'CL' ||
                        LMRY_Result[0] == 'BO' || LMRY_Result[0] == 'PE' || LMRY_Result[0] == 'GT') {

                        // Validacion de Features & Country
                        swFeature = false;

                        // Brasil
                        if (LMRY_Result[0] == 'BR' && Library_Mail.getAuthorization(140, licenses) && !Library_Mail.getAuthorization(416, licenses)) {
                            swFeature = true;
                        }

                        // Mexico
                        if (LMRY_Result[0] == 'MX' && Library_Mail.getAuthorization(20, licenses) == true) {
                            swFeature = true;
                        }

                        // Ecuador
                        if (LMRY_Result[0] == 'EC' && Library_Mail.getAuthorization(42, licenses) == true) {
                            swFeature = true;
                        }

                        //Uruguay
                        //  if (LMRY_Result[0] == 'UY' && Library_Mail.getAuthorization(39, licenses) == true) {
                        //   swFeature = true;
                        // }

                        //Costa Rica
                        // if (LMRY_Result[0] == 'CR' && Library_Mail.getAuthorization(24, licenses) == true) {
                        //   swFeature = true;
                        // }

                        //Chile
                        // if (LMRY_Result[0] == 'CL' && Library_Mail.getAuthorization(98, licenses) == true) {
                        //   swFeature = true;
                        // }

                        //Bolivia
                        // if (LMRY_Result[0] == 'BO' && Library_Mail.getAuthorization(37, licenses) == true) {
                        //   swFeature = true;
                        // }

                        //Peru
                        if (LMRY_Result[0] == 'PE' && Library_Mail.getAuthorization(136, licenses) == true) {
                            swFeature = true;
                        }

                        //Guatemala
                        if (LMRY_Result[0] == 'GT' && Library_Mail.getAuthorization(133, licenses) == true) {
                            swFeature = true;
                        }
                        /******************** MODIFICACIÓN 06/02/2020 ***************************
                         Descripción: Se valida que el tipo de contexto sea diferente a USEREVENT
                         para que no se borren los valores de los campo de LatamReady:
                           * Latam - Wtax Code Descripcion
                           * Latam - WTax Code
                           * Latam - WTax Rate
                           * Latam - Wtax Amount
                           * Latam - WBase Amount
                         Cuando se ejecuta un WORKFLOW DE APROBACIÓN
                         ************************************************************************/

                        // si está activo Feature de Localización y tipo de Contexto diferente a USEREVENT
                        var typeInterfaces = ['USEREVENT', 'SCHEDULED'];
                        log.debug('typeInterfaces', typeInterfaces);

                        if (swFeature == true && typeInterfaces.indexOf(type_interface) == -1) {
                            var appliesto = RCD.getValue({
                                fieldId: 'custpage_4601_appliesto'
                            });
                            var witaxamount = RCD.getValue({
                                fieldId: 'custpage_4601_witaxamount'
                            });

                            var witaxbaseamount = RCD.getValue({
                                fieldId: 'custpage_4601_witaxbaseamount'
                            });

                            //Solo aparece con Applies to = Total Amount (T)
                            var witaxcode = RCD.getValue({
                                fieldId: 'custpage_4601_witaxcode'
                            });
                            if (appliesto == false || appliesto == 'F' || witaxcode === undefined) {
                                witaxcode == null;
                            }
                            var witaxrate = RCD.getValue({
                                fieldId: 'custpage_4601_witaxrate'
                            });

                            // 2021.05.17 Se agrega la descripcion de NS WHT
                            var witaxname = '';
                            if (witaxcode != null && witaxcode != '' && witaxcode != undefined) {
                                // Bundle 47459 - Withholding Tax
                                // Withholding Tax Code - customrecord_4601_witaxcode
                                var wtax_type = search.lookupFields({
                                    type: 'customrecord_4601_witaxcode',
                                    id: witaxcode,
                                    columns: ['custrecord_4601_wtc_witaxtype']
                                });
                                // Withholding Tax Type - customrecord_4601_witaxtype
                                var wtaxtype_name = search.lookupFields({
                                    type: 'customrecord_4601_witaxtype',
                                    id: wtax_type.custrecord_4601_wtc_witaxtype[0].value,
                                    columns: ['custrecord_4601_wtt_name']
                                });
                                // Name - custrecord_4601_wtt_name
                                witaxname = wtaxtype_name.custrecord_4601_wtt_name
                            }
                            /* MODIFICACION DEL URET
                            Descripcion: Cuando no hay retencion los campos TaxRate y TaxCode se setea con espacios en blancos.
                            Fecha:28/08/2019
                            */
                            if (witaxamount == 0.00 && witaxbaseamount == 0.00) {
                                witaxrate = '';
                                witaxcode = ''
                            }
                            //Fin Modificacion
                            if (appliesto == false || appliesto == 'F' || witaxrate === undefined) {
                                witaxrate == null;
                            }
                            if (witaxamount === undefined) {
                                witaxamount == null;
                            }
                            if (witaxbaseamount === undefined) {
                                witaxbaseamount == null;
                            }

                            /***********************************
                             * Se copian los valores de WHT
                             * a nuestros campos LatamReady
                             * Latam - Wtax Code Descripcion
                             * Latam - WTax Code
                             * Latam - WTax Rate
                             * Latam - Wtax Amount
                             * Latam - WBase Amount
                             ***********************************/
                            /* custbody_lmry_wtax_code_des */
                            var otherId = record.submitFields({
                                type: 'invoice',
                                id: LMRY_Intern,
                                values: {
                                    'custbody_lmry_wtax_code': witaxcode,
                                    'custbody_lmry_wtax_code_des': witaxname,
                                    'custbody_lmry_wtax_rate': witaxrate,
                                    'custbody_lmry_wtax_amount': witaxamount,
                                    'custbody_lmry_wbase_amount': witaxbaseamount
                                },
                                options: {
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true
                                }
                            });

                            // Valores actualizados
                            log.debug(' Actualiza campos Latam - Wtax', 'witaxcode : ' + witaxcode +
                                ' , custbody_lmry_wtax_code_des : ' + witaxname +
                                ' , witaxrate : ' + witaxrate +
                                ' , witaxamount : ' + witaxamount +
                                ' , witaxbaseamount : ' + witaxbaseamount);
                        } // Validacion de Features

                    } // Solo para localizacion
                }

                //GROUP LINE: NEW LATAMREADY LATAMTAX SALES
                if ((type_event == 'create' || type_event == 'edit') && LMRY_Result[0] == 'AR' && Library_Mail.getAuthorization(540, licenses)) {
                    GroupLine(scriptContext, LMRY_Intern);
                }

                //EC TRANSACTION FIELDS
                if ((type_event == 'create' || type_event == 'edit') && LMRY_Result[0] == 'EC' && (Library_Mail.getAuthorization(630, licenses) || Library_Mail.getAuthorization(639, licenses))) {
                    ECsetAmounts(LMRY_Intern);
                }

                /*****************************************************
                 Update Transaction Fields Peru
                 -----------------------------------------------------
                 User : Richard Galvez Lopez
                 Date : 09/11/2021
                ******************************************************/
                PE_libMapTransactions.updateTransactionFields(scriptContext);
                /*****************************************************/

            } catch (err) {
                RCD_OBJ = scriptContext.newRecord;
                Library_Mail.sendemail2(' [ afterSubmit ] ' + err, LMRY_script, RCD_OBJ, 'tranid', 'entity');
            }
            return true;
        }

        /* ------------------------------------------------------------------------------------------------------
         * Se ejecuta solamente cuando se creao y/o edita la transaccion
         * --------------------------------------------------------------------------------------------------- */
        function afterSubmit_newedi(RCD, scriptContext, LMRY_Result, ORCD) {
            //var RCD = scriptContext.newRecord;
            ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });
            try {
                if (RCD.getValue({
                    fieldId: 'memo'
                }) != 'VOID') {

                    // Solo para Mexico - Enabled Feature Redireccionamiento de Cuentas
                    if (LMRY_Result[0] == 'MX') {
                        if (Library_Mail.getAuthorization(22, licenses) == true) {
                            // Elimina los asientos
                            Library_Validation.Delete_JE(scriptContext.newRecord.id);

                            // Realiza la redireccion de cuentas
                            if (ST_FEATURE != true || ST_FEATURE != "T") {
                                Library_Accounts.Create_Redirect_Inv(scriptContext.newRecord.id);
                            }
                        }
                    }

                    /*************************************
                     * Creacion de retencion sin CC V1.0
                     * para Colombia, Bolivia y Ecuador -
                     * Enabled Feature WHT Latam
                     /*************************************/
                    var swAccess = false;
                    if (LMRY_Result[0] == 'CO') {
                        swAccess = Library_Mail.getAuthorization(27, licenses);
                    }
                    if (LMRY_Result[0] == 'BO') {
                        swAccess = Library_Mail.getAuthorization(46, licenses);
                    }
                    if (LMRY_Result[0] == 'EC') {
                        swAccess = Library_Mail.getAuthorization(41, licenses);
                    }

                    //***************** Modificacion 6 de Setiembre 2019  **********************
                    /* Descripcion: En caso el Feature Approval Routing Invoice este activo,
                    las retenciones seran generadas solo si el Invoice tiene el estado  aprobado*/

                    //Obteniendo el estado del Feature Approval Routing: Invoice
                    var featureApprovalInvoice = runtime.getCurrentScript().getParameter({
                        name: 'CUSTOMAPPROVALCUSTINVC'
                    });

                    log.debug('featureApprovalInvoice', featureApprovalInvoice);

                    //si esta activo el feature Approval Routing,
                    if (featureApprovalInvoice == 'T') {
                        //  log.debug('FEATURE ACTIVO INVOICE');
                        var approvalStatus = 0;
                        //Obteniendo el estado del approvalstatus del invoice
                        approvalStatus = RCD.getValue({
                            fieldId: 'approvalstatus'
                        });

                        log.debug('approvalStatus : ' + approvalStatus, 'swAccess : ' + swAccess);

                        // Si hay acceso y el Invoice esta aprobado, procesa
                        if (swAccess == true && approvalStatus == 2) {
                            // Realiza la redireccion de cuentas
                            Library_Validation.Create_WHT_Latam('invoice', scriptContext.newRecord.id, ORCD);
                            //log.debug('invoice', scriptContext.newRecord.id);
                        }

                    } else { // Si no esta activo
                        //Si hay acceso Procesa
                        if (swAccess) {
                            // Realiza la redireccion de cuentas
                            Library_Validation.Create_WHT_Latam('invoice', scriptContext.newRecord.id, ORCD);
                        }
                    }

                    //******************* Fin de Modificacion 6 de Setiembre 2019 **********************


                    /*************************************
                     * Agrupacion de impuesto para
                     * Paraguay - Enabled Feature WHT Latam
                    /*************************************/
                    if (LMRY_Result[0] == 'PY') {
                        if (Library_Mail.getAuthorization(47, licenses) == true) {
                            // Realiza la redireccion de cuentas
                            PY_Tax_Group(RCD, scriptContext.newRecord.id);
                        }
                    }

                } // Cierre del void

                // Control de error
            } catch (err) {
                Library_Mail.sendemail2(' [ afterSubmit_newedi ] ' + err, LMRY_script, RCD, 'tranid', 'entity');
            }
        }

        /* ------------------------------------------------------------------------------------------------------
         * Se ejecuta solamente cuando se elimina la transaccion
         * --------------------------------------------------------------------------------------------------- */
        function afterSubmit_delete(LMRY_Result, LMRY_Intern) {
            try {
                // Solo para Mexico
                if (LMRY_Result[0] == 'MX' && LMRY_Result[3] == true && LMRY_Result[2] == true) {
                    // Elimina registros
                    Library_Validation.Delete_JE(LMRY_Intern);
                }

                // Para Colombia, Bolivia y Paraguay - Enabled Feature WHT Latam
                var swAccess = false;
                if (LMRY_Result[0] == 'CO') {
                    swAccess = Library_Mail.getAuthorization(27, licenses);
                }
                if (LMRY_Result[0] == 'BO') {
                    swAccess = Library_Mail.getAuthorization(46, licenses);
                }
                if (LMRY_Result[0] == 'PY') {
                    swAccess = Library_Mail.getAuthorization(47, licenses);
                }

                // Si hay acceso elimina
                if (swAccess) {
                    // Elimina registros
                    Library_Validation.Delete_JE(LMRY_Intern);

                    // Delete Credit Memo
                    Library_Validation.Delete_CM('creditmemo', LMRY_Intern);
                }
            } catch (err) {
                Library_Mail.sendemail2(' [ afterSubmit_delete ] ' + err, LMRY_script, RCD_OBJ, 'tranid', 'entity');
            }
        }

        /* ------------------------------------------------------------------------------------------------------
         * Actualizacion del campo TranID por la concatenacion de los valores de los campos Serie CxC y
         * Numero Preimpreso de la transacción luego de ser enviada electrónicamente
         * --------------------------------------------------------------------------------------------------- */
        function Update_Field_TranID(inv_internalid) {
            try {
                var texto = '';

                // valida que exista internalid
                if (inv_internalid == '' || inv_internalid == null) {
                    return true;
                }

                texto = RCD_OBJ.getText({
                    fieldId: 'custbody_lmry_serie_doc_cxc'
                }) +
                    '-' + RCD_OBJ.getValue({
                        fieldId: 'custbody_lmry_num_preimpreso'
                    });

                RCD_OBJ.setValue({
                    fieldId: 'tranid',
                    value: texto
                });
            } catch (err) {
                Library_Mail.sendemail2(' [ Update_Field_TranID ] ' + err, LMRY_script, RCD_OBJ, 'tranid', 'entity');
            }
            return true;
        }

        /* ------------------------------------------------------------------------------------------------------
         * Procesa las lineas de la transaccion para extraer
         * los impuestos a un registro personalizado
         * --------------------------------------------------------------------------------------------------- */
        function PY_Tax_Group(RCD, inv_internalid) {
            //var RCD = scriptContext.newRecord;
            try {
                // valida que exista internalid
                if (inv_internalid == '' || inv_internalid == null) {
                    return true;
                }

                //Variable global LATAM - VERSION BETA
                var VerBeta = runtime.getCurrentScript().getParameter({
                    name: 'custscript_lmry_version_beta'
                });

                if (VerBeta == 'F') {
                    return true;
                }

                // Carga la factura
                var RCD = record.load({
                    type: record.Type.INVOICE,
                    id: inv_internalid
                });

                // Totales de Tax en cabecera
                var h_taxiva = 0;
                var h_taxret = 0;
                var h_taxest = 0;

                // Se suma los mismos codigos de impuesto
                var recQY = RCD.getLineCount({
                    sublistId: 'item'
                });
                for (var pos = 0; pos < recQY; pos++) {
                    var linnro = RCD.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        line: pos
                    }); // taxcode
                    var linitm = RCD.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: pos
                    }); // item
                    var lintax = RCD.getSublistText({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        line: pos
                    }); // taxcode
                    var linamo = RCD.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: pos
                    }); // amount
                    var linrte = RCD.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'tax1amt',
                        line: pos
                    });
                    // taxamount
                    //  Filtros del Query
                    var filters = new Array();
                    //filters[0] = new nlobjSearchFilter('custrecord_lmry_tax_name', null, 'is', lintax);
                    //if (lintax != '' && lintax != null) {
                    filters[0] = search.createFilter({
                        name: 'custrecord_lmry_tax_name',
                        operator: search.Operator.IS,
                        values: [lintax]
                    });
                    //}


                    var columns = new Array();
                    columns[0] = search.createColumn({
                        name: 'name'
                    });
                    columns[1] = search.createColumn({
                        name: 'custrecord_lmry_tax_iva'
                    });
                    columns[2] = search.createColumn({
                        name: 'custrecord_lmry_tax_rete_ir'
                    });
                    columns[3] = search.createColumn({
                        name: 'custrecord_lmry_tax_rete_estado'
                    });
                    var trandata = search.create({
                        type: 'customrecord_lmry_tax_group',
                        columns: columns,
                        filters: filters
                    });
                    trandata = trandata.run().getRange({
                        start: 0,
                        end: 1000
                    })


                    if (trandata != '' && trandata != null) {
                        // Nombre del grupo impuesto
                        var tranid = trandata[0].getValue('name');
                        // Porcentajes de impuesto
                        var taxiva = trandata[0].getValue('custrecord_lmry_tax_iva');
                        if (taxiva == '' || taxiva == null) {
                            taxiva = 0;
                        }
                        taxiva = (linamo * taxiva) / 100;
                        var taxret = trandata[0].getValue('custrecord_lmry_tax_rete_ir');
                        if (taxret == '' || taxret == null) {
                            taxret = 0;
                        }
                        taxret = (linamo * taxret) / 100;
                        var taxest = trandata[0].getValue('custrecord_lmry_tax_rete_estado');
                        if (taxest == '' || taxest == null) {
                            taxest = 0;
                        }
                        taxest = (linamo * taxest) / 100;



                        // Graba en el registro personalizado
                        var newrecord = record.create({
                            type: 'customrecord_lmry_tax_transactions_line'
                        });
                        newrecord.setValue({
                            fieldId: 'name',
                            value: tranid
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_referen',
                            value: inv_internalid
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_line',
                            value: linnro
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_item',
                            value: linitm
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_amount',
                            value: linamo
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_iva',
                            value: taxiva
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_reteir',
                            value: taxret
                        });
                        newrecord.setValue({
                            fieldId: 'custrecord_lmry_tax_transactions_reteest',
                            value: taxest
                        });

                        var guardarer = newrecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });;

                        // Acumula totales
                        h_taxiva = parseFloat(h_taxiva) + parseFloat(taxiva);
                        h_taxret = parseFloat(h_taxret) + parseFloat(taxret);
                        h_taxest = parseFloat(h_taxest) + parseFloat(taxest);
                    }
                }
                newrecord = null;

                // Actualiza los campos de cabecera
                record.submitFields({
                    type: record.Type.INVOICE,
                    id: inv_internalid,
                    values: {
                        custbody_lmry_py_tax_amount_iva: h_taxiva,
                        custbody_lmry_py_tax_amount_rete_ir: h_taxret,
                        custbody_lmry_py_tax_amount_rete_state: h_taxest
                    },
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

            } catch (err) {
                Library_Mail.sendemail2(' [ PY_Tax_Group ] ' + err, LMRY_script, RCD, 'tranid', 'entity');
            }
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
                type: 'invoice',
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


        /* ------------------------------------------------------------------------------------------------------
         * A la variable featureId se le asigna el valore que le corresponde
         * --------------------------------------------------------------------------------------------------- */
        function ValidateAccessInv(ID, RCD, isURET, type) {

            var LMRY_access = false;
            var LMRY_countr = new Array();
            var LMRY_Result = new Array();
            try {

                // Inicializa variables Locales y Globales
                LMRY_countr = Library_Mail.Validate_Country(ID);

                // Verifica que el arreglo este lleno
                if (LMRY_countr.length < 1) {
                    LMRY_Result[0] = '';
                    LMRY_Result[1] = '-None-';
                    LMRY_Result[2] = LMRY_access;
                    return LMRY_Result;
                }

                LMRY_access = Library_Mail.getCountryOfAccess(LMRY_countr, licenses);

                // Asigna Valores
                LMRY_Result[0] = LMRY_countr[0];
                LMRY_Result[1] = LMRY_countr[1];
                LMRY_Result[2] = LMRY_access;
                LMRY_Result = activate_fe(LMRY_Result, licenses);

            } catch (err) {
                Library_Mail.sendemail2(' [ ValidateAccessInv ] ' + err, LMRY_script, RCD, 'tranid', 'entity');
            }

            return LMRY_Result;
        }

        function activate_fe(fe_countr, licenses) {
            var autfe = false;
            var authorizations_fe = {
                'AR': 246,
                'BO': 247,
                'BR': 248,
                'CL': 249,
                'CO': 250,
                'CR': 251,
                'EC': 252,
                'SV': 253,
                'GT': 254,
                'MX': 255,
                'PA': 256,
                'PY': 257,
                'PE': 258,
                'UY': 259,
                'NI': 407,
                'DO': 400
            };

            if (authorizations_fe[fe_countr[0]]) {
                autfe = Library_Mail.getAuthorization(authorizations_fe[fe_countr[0]], licenses);
            }

            if (autfe == true) {
                fe_countr.push(true);
            } else {
                fe_countr.push(false);
            }
            return fe_countr;
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

        function updateInstallments(recordObj) {
            var catalog = recordObj.getSublistValue({
                sublistId: "item",
                fieldId: "custcol_lmry_br_service_catalog",
                line: 0
            });
            if (catalog) {
                var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({
                    feature: "installments"
                });
                if (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true) {
                    var numInstallments = recordObj.getLineCount({
                        sublistId: "installment"
                    });
                    if (numInstallments) {
                        var installments = {};
                        var searchInstallments = search.create({
                            type: "invoice",
                            filters: [
                                ["internalid", "anyof", recordObj.id], "AND",
                                ["mainline", "is", "T"]
                            ],
                            columns: [
                                search.createColumn({
                                    name: "installmentnumber",
                                    join: "installment",
                                    sort: search.Sort.ASC
                                }),
                                "installment.fxamount",
                                "installment.duedate",
                                "internalid"
                            ],
                            settings: [search.createSetting({
                                name: 'consolidationtype',
                                value: 'NONE'
                            })]
                        });

                        var columns = searchInstallments.columns;
                        var results = searchInstallments.run().getRange(0, 1000);
                        for (var i = 0; i < results.length; i++) {
                            var number = results[i].getValue(columns[0]);
                            var amount = results[i].getValue(columns[1]) || 0.00;
                            var duedate = results[i].getValue(columns[2]);
                            amount = parseFloat(amount);
                            if (number) {
                                installments[String(number)] = {
                                    "amount": amount,
                                    "duedate": duedate
                                };
                            }
                        }

                        var searchBRTransactionFields = search.create({
                            type: "customrecord_lmry_br_transaction_fields",
                            filters: [
                                ["isinactive", "is", "F"], "AND",
                                ["custrecord_lmry_br_related_transaction", "anyof", recordObj.id]
                            ],
                            columns: ["internalid", "custrecord_lmry_br_interes", "custrecord_lmry_br_multa"]
                        });

                        var results = searchBRTransactionFields.run().getRange(0, 10);
                        if (results && results.length) {
                            var idBrTransactionField = results[0].getValue("internalid");

                            record.submitFields({
                                type: "customrecord_lmry_br_transaction_fields",
                                id: idBrTransactionField,
                                values: {
                                    "custrecord_lmry_br_installments": JSON.stringify(installments)
                                },
                                options: {
                                    disableTriggers: true
                                }
                            });
                        }
                    }
                }
            }
        }


        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });
