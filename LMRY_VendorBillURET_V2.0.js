/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_VendorBillURET_V2.0.js                      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 14 2018  LatamReady    User Event 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/runtime', 'N/search', 'N/log', 'N/config', 'N/https', 'N/url', 'N/ui/serverWidget',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_libWhtValidationLBRY_V2.0',
        './Latam_Library/LMRY_libDIOTLBRY_V2.0', './WTH_Library/LMRY_TAX_TransactionLBRY_V2.0',
        './WTH_Library/LMRY_ST_Tax_TransactionLBRY_V2.0', './Latam_Library/LMRY_GLImpact_LBRY_V2.0',
        './Latam_Library/LMRY_HideViewLBRY_V2.0', './Latam_Library/LMRY_HideView3LBRY_V2.0',
        './WTH_Library/LMRY_Country_WHT_Lines_LBRY_V2.0', './Latam_Library/LMRY_ExchangeRate_LBRY_V2.0',
        './WTH_Library/LMRY_RetencionesEcuador_LBRY', './WTH_Library/LMRY_GT_Withholding_Line_LBRY_V2.0',
        './WTH_Library/LMRY_BR_GLImpact_Popup_LBRY', './WTH_Library/LMRY_TransferIva_LBRY',
        "./Latam_Library/LMRY_CL_ST_Transaction_Purchases_LBRY_V2.0", './WTH_Library/LMRY_EC_BaseAmounts_TaxCode_LBRY',
        './Latam_Library/LMRY_CO_ST_Purchase_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_MX_ST_Purchase_Tax_Transaction_LBRY_V2.0',
        './Latam_Library/LMRY_MX_ST_DIOT_LBRY_V2.0', './Latam_Library/LMRY_AR_ST_Purchase_Tax_Transaction_LBRY_V2.0',
        './Latam_Library/LMRY_AR_ST_WHT_TransactionFields_LBRY_V2.0'
    ],

    function(record, runtime, search, log, config, https, url, serverWidget, library, library1, libraryDIOT, Library_WHT_Transaction, ST_Library_Transaction,
        libraryGLImpact, Library_HideView, library_hideview3, libWHTLines, library_ExchRate, Library_RetencionesEcuador, Library_WHT_GT, library_GLImpact_Popup,
        LibraryTransferIva, library_CL_Purchases, libraryEcBaseAmounts,
        CO_ST_TaxLibrary, MX_ST_TaxLibrary, MX_ST_DIOT_Library, AR_ST_TaxLibrary, AR_ST_WhtLibrary) {

        var scriptObj = runtime.getCurrentScript();
        var type = '';
        var LMRY_script = 'LatamReady - Vendor Bill URET V2.0';
        var isURET = true;
        var recordObj = null;
        var licenses = [];

        var ST_FEATURE = false;

        function beforeLoad(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                recordObj = context.newRecord;
                type = context.type;
                var country = new Array();
                country[0] = '';
                country[1] = '';
                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                if (context.type == 'create' || context.type == 'copy') {

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

                if (context.type != 'print' && context.type != 'email') {
                    licenses = library.getLicenses(subsidiary);
                    if (licenses == null || licenses == '') {
                        licenses = [];
                        library_hideview3.PxHide(form, '', recordObj.type);
                        library_hideview3.PxHideSubTab(form, '', recordObj.type);
                        library_hideview3.PxHideColumn(form, '', recordObj.type);
                    }
                }

                if (context.type != 'print' && context.type != 'email') {
                    try {
                        if (subsidiary == '' || subsidiary == null) {
                            var userS = runtime.getCurrentUser();
                            subsidiary = userS.subsidiary;
                        }
                        if (subsidiary != '' && subsidiary != null) {
                            var filters = new Array();
                            filters[0] = search.createFilter({
                                name: 'internalid',
                                operator: search.Operator.ANYOF,
                                values: [subsidiary]
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
                        var hide_transaction = library.getHideView(country, 2, licenses);
                        var hide_sublist = library.getHideView(country, 5, licenses);
                        var hide_column = library.getHideView(country, 3, licenses);

                        if (library.getCountryOfAccess(country, licenses)) {
                            if (hide_transaction == true) {
                                library_hideview3.PxHide(form, country[0], recordObj.type);
                            }
                            if (hide_sublist == true) {
                                library_hideview3.PxHideSubTab(form, country[0], recordObj.type);
                            }
                            if (hide_column == true) {
                                library_hideview3.PxHideColumn(form, country[0], recordObj.type);
                            }
                        } else {
                            if (hide_transaction == true) {
                                library_hideview3.PxHide(form, '', recordObj.type);
                            }
                            if (hide_sublist == true) {
                                library_hideview3.PxHideSubTab(form, '', recordObj.type);
                            }
                            if (hide_column == true) {
                                library_hideview3.PxHideColumn(form, '', recordObj.type);
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
                    // Valida que tenga acceso
                    var LMRY_Result = ValidateAccessVB(subsidiary);

                    if (ST_FEATURE == true || ST_FEATURE == 'T') {
                        if (['create', 'edit', 'copy'].indexOf(context.type) != -1) {
                            switch (LMRY_Result[0]) {
                                case "MX":
                                    MX_ST_TaxLibrary.disableInvoicingIdentifier(context);
                                    break;
                                case "AR":
                                    AR_ST_TaxLibrary.disableInvoicingIdentifier(context);
                                    break;
                            }

                        }
                    }

                    // Solo para Mexico
                    if (LMRY_Result[0] == 'MX' && LMRY_Result[3] == true) {
                        // Lista de estado de proceso
                        var procesado = recordObj.getValue({
                            fieldId: 'custbody_lmry_schedule_transfer_of_iva'
                        });
                        // Verifica si esta procesado y si esta activo el feature de bloqueo de transaccion
                        if (procesado == 1) {
                            if (library.getAuthorization(97, licenses)) {
                                // Elimina el boton de edicion
                                form.removeButton('edit');
                            }
                        }
                    } // Fin Solo para Mexico

                    // Solo localizacion CO
                    if (LMRY_Result[0] == 'CO') {
                        if (library.getAuthorization(340, licenses)) {
                            var formObj = context.form;
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
                    } // Fin Solo localizacion CO

                    // Solo en el evento View
                    if (type == 'view') {

                        var featurelang = runtime.getCurrentScript().getParameter({
                            name: 'LANGUAGE'
                        });

                        featurelang = featurelang.substring(0, 2);

                        // Logica GL Impact
                        var btnGl = libraryGLImpact.featureGLImpact(recordObj, 'vendorbill');
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
                        if (library.getAuthorization(552, licenses)) {
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

                        // BR - Update CFOP	(11.11.2020)
                        if (LMRY_Result[0] == 'BR' && library.getAuthorization(554, licenses)) {
                            if (featurelang == 'es') {
                                form.addButton({
                                    id: 'custpage_id_button_update_cfop',
                                    label: 'ACTUALIZAR CFOP',
                                    functionName: 'onclick_event_update_cfop()'
                                });
                            } else if (featurelang == 'pt') {
                                form.addButton({
                                    id: 'custpage_id_button_update_cfop',
                                    label: 'ATUALIZAR CFOP',
                                    functionName: 'onclick_event_update_cfop()'
                                });
                            } else {
                                form.addButton({
                                    id: 'custpage_id_button_update_cfop',
                                    label: 'UPDATE CFOP',
                                    functionName: 'onclick_event_update_cfop()'
                                });
                            }
                            form.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
                        }

                        // Solo para Colombia
                        if (LMRY_Result[0] == 'CO' && LMRY_Result[2] == true && LMRY_Result[3] == true) {
                            // LATAM - LEGAL DOCUMENT TYPE
                            var docufisc = recordObj.getValue({
                                fieldId: 'custbody_lmry_document_type'
                            });

                            /* Valida que no sea Nulo */
                            if (docufisc == '' || docufisc == null) {
                                return true;
                            }

                            // Latam - CO Tipo Documento Equivalente - Preferencias Generales de Empresa
                            var tipodocu = scriptObj.getParameter({
                                name: 'custscript_lmry_co_tipo_fiscal_de'
                            });

                            /* Valida que no sea Nulo */
                            if (tipodocu == '' || tipodocu == null) {
                                return true;
                            }

                            form.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';

                            /* Solo si los dos campos son iguales muestra el boton */
                            if (docufisc == tipodocu) {
                                form.addButton({
                                    id: 'custpage_Add_Button',
                                    label: 'Imprimir DE',
                                    functionName: 'onclick_event()'
                                });

                            }
                        }

                        // Solo para Peru
                        if (LMRY_Result[0] == 'PE' && LMRY_Result[2] == true && LMRY_Result[3] == true) {
                            // busca valor conforme nombre del campo
                            var value = recordObj.getValue({
                                fieldId: 'custbody_lmry_transaction_type_doc'
                            });

                            /* Valida que no sea Nulo */
                            if (value == '' || value == null) {
                                return true;
                            }

                            /* Se realiza una busqueda para ver que campos se ocultan */
                            // Filtros
                            var filters = new Array();
                            filters[0] = search.createFilter({
                                name: 'custrecord_lmry_id_transaction',
                                operator: search.Operator.IS,
                                values: value
                            });


                            // Realiza un busqueda para mostrar los campos
                            var hidefieldsSearch = search.create({
                                type: 'customrecord_lmry_transaction_fields',
                                columns: ['custrecord_lmry_id_fields'],
                                filters: filters
                            });

                            var hidefields = hidefieldsSearch.run().getRange(0, 1000);

                            if (hidefields != null && hidefields != '') {
                                for (var i = 0; i < hidefields.length; i++) {
                                    var namefield = hidefields[i].getText('custrecord_lmry_id_fields');
                                    if (namefield != '' && namefield != null) {
                                        var Field = recordObj.getField({
                                            fieldId: namefield
                                        });
                                        if (Field != null && Field != '') {
                                            Field.isDisplay = true;
                                        }
                                    }
                                }
                            } // Realiza un busqueda para mostrar los campos
                        } // Solo para Peru

                    } // Fin Solo en el evento View

                    /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                     * Fecha : 21 de abril de 2020
                     * Se agrego que todas las validacion sean dentro
                     * de la condicional :
                     *    if (type == 'create')
                     * * * * * * * * * * * * * * * * * * * * * * * * * * */
                    if (type == 'create' || type == 'copy') {
                        /* *** Logica de Tipo de Cambio Automatico *** */
                        if (LMRY_Result[0] == 'MX') {
                            if (library.getAuthorization(528, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'BR') {
                            if (library.getAuthorization(529, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'CO') {
                            if (library.getAuthorization(533, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'CL') {
                            if (library.getAuthorization(530, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'PE') {
                            if (library.getAuthorization(531, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        if (LMRY_Result[0] == 'AR') {
                            if (library.getAuthorization(532, licenses)) {
                                library_ExchRate.createFieldURET(context, serverWidget);
                            }
                        }
                        /* *** Fin Logica de Tipo de Cambio Automatico *** */

                    } // Fin if (type == 'create')

                    /* * * * * * * * * * * * * * * * * * * * * * * * * * *
                     * Fecha : 16 de abril de 2020
                     * Se agrego la validacion que la localizacion este
                     * activado. LMRY_Result[2] == true
                     * 262 =  br - activate bill (05/06/2020)
                     * * * * * * * * * * * * * * * * * * * * * * * * * * */
                    // HIDE AND VIEW POPUP
                    if (LMRY_Result[0] == 'BR' && LMRY_Result[2] == true && library.getAuthorization(262, licenses)) {
                        var pop_cabecera = form.getField('custbody_lmry_br_popup');
                        if (library.getAuthorization(290, licenses) == false) {

                            // CustBody - Valida si existe campo
                            if (pop_cabecera != '' && pop_cabecera != null) {
                                pop_cabecera.updateDisplayType({
                                    displayType: 'hidden'
                                });
                            }

                            // *** Validacion para ITEM ***
                            var sublist_item = form.getSublist('item');
                            var pop_columna = sublist_item.getField({
                                id: 'custcol_lmry_br_popup'
                            });

                            // CustCol - Valida si el JSON esta lleno
                            if (typeof(pop_columna) == 'object') {
                                // CustCol - Valida si el JSON esta lleno
                                if (JSON.stringify(pop_columna) != '{}') {
                                    pop_columna.updateDisplayType({
                                        displayType: 'hidden'
                                    });
                                } // Fin - CustCol - Valida si el JSON esta lleno
                            }

                            // *** Validacion para EXPENSE ***
                            var sublist_expense = form.getSublist('expense');
                            var pop_columna = sublist_expense.getField({
                                id: 'custcol_lmry_br_popup'
                            });

                            // CustCol - Valida si el JSON esta lleno
                            if (typeof(pop_columna) == 'object') {
                                // CustCol - Valida si el JSON esta lleno
                                if (JSON.stringify(pop_columna) != '{}') {
                                    pop_columna.updateDisplayType({
                                        displayType: 'hidden'
                                    });
                                } // Fin - CustCol - Valida si el JSON esta lleno
                            }

                        } else {
                            var id_br = recordObj.id;
                            //YA ESTA CREADA LA PO
                            if (id_br != null && id_br != '' && id_br != undefined) {
                                var search_br = search.create({
                                    type: 'customrecord_lmry_br_transaction_fields',
                                    filters: [{
                                        name: 'custrecord_lmry_br_related_transaction',
                                        operator: 'is',
                                        values: id_br
                                    }]
                                });
                                search_br = search_br.run().getRange({
                                    start: 0,
                                    end: 1
                                });

                                if (search_br != null && search_br.length > 0) {
                                    // CustBody - Valida si existe campo
                                    if (pop_cabecera != '' && pop_cabecera != null) {
                                        pop_cabecera.updateDisplayType({
                                            displayType: 'hidden'
                                        });
                                    }
                                }
                            }
                        }

                        // Solo en el evento Type Copy
                        if (type == 'copy') {
                            // CustBody - Valida si existe campo
                            var json_cabecera = form.getField('custbody_lmry_br_json');
                            if (json_cabecera != '' && json_cabecera != null) {
                                recordObj.setValue('custbody_lmry_br_json', '');

                                // Validacion en la lista ITEM
                                var sublist_item = form.getSublist('item');
                                var json_columna = sublist_item.getField({
                                    id: 'custcol_lmry_br_json'
                                });
                                // Valida si es Objeto
                                if (typeof(json_columna) == 'object') {
                                    // CustCol - Valida si el JSON esta lleno
                                    if (JSON.stringify(json_columna) != '{}') {
                                        // Limpia la columna JSON
                                        for (var i = 0; i < recordObj.getLineCount({
                                                sublistId: 'item'
                                            }); i++) {
                                            recordObj.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_lmry_br_json',
                                                line: i,
                                                value: ''
                                            });
                                        }
                                    } // Fin - CustCol - Valida si el JSON esta lleno
                                } // Fin - Valida si es Objeto

                                // Validacion en la lista EXPENSE
                                var sublist_expense = form.getSublist('expense');
                                var json_columna = sublist_expense.getField({
                                    id: 'custcol_lmry_br_json'
                                });
                                // Valida si es Objeto
                                if (typeof(json_columna) == 'object') {
                                    // CustCol - Valida si el JSON esta lleno
                                    if (JSON.stringify(json_columna) != '{}') {
                                        // Limpia la columna JSON
                                        for (var i = 0; i < recordObj.getLineCount({
                                                sublistId: 'expense'
                                            }); i++) {
                                            recordObj.setSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'custcol_lmry_br_json',
                                                line: i,
                                                value: ''
                                            });
                                        }
                                    } // Fin - CustCol - Valida si el JSON esta lleno
                                } // Fin - Valida si es Objeto
                            }
                        } // Fin - Type Copy

                    } // Fin HIDE AND VIEW POPUP

                    if (LMRY_Result[0] == 'BR') {
                        var recordObj = context.newRecord;
                        if (type == 'copy' || type == 'xcopy') {
                            if (ST_FEATURE === true || ST_FEATURE === "T") {
                                ST_Library_Transaction.cleanLinesforCopy(recordObj, licenses);
                            } else {
                                Library_WHT_Transaction.cleanLinesforCopy(recordObj, licenses);
                            }
                        }

                        log.debug("transformid", recordObj.getValue("transformid"));
                        if (type == 'create') {
                            var transformid = recordObj.getValue({
                                fieldId: 'transformid'
                            });

                            //Si el bill es creado desde un PO
                            if (transformid) {
                                if (ST_FEATURE === true || ST_FEATURE === "T") {
                                    ST_Library_Transaction.cleanLinesforCopy(recordObj, licenses);
                                } else {
                                    Library_WHT_Transaction.cleanLinesforCopy(recordObj, licenses);
                                }
                            }
                        }
                    }

                    // Nueva logica Chile
                    if (LMRY_Result[0] == 'CL') {
                        if (type == 'copy' || type == 'xcopy') {
                            if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                library_CL_Purchases.cleanLinesforCopy(recordObj, licenses);
                            }

                        }

                        if (type == 'create' || type == 'copy') {
                            var createdFrom = recordObj.getValue({
                                fieldId: 'createdfrom',
                            });

                            if (createdFrom) {
                                if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                    library_CL_Purchases.cleanLinesforCopy(recordObj, licenses);
                                }

                            }
                        }
                    }

                    // SuiteTax Colombia
                    if (LMRY_Result[0] == "CO") {
                        if (type == "copy" || type == "xcopy") {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                CO_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                            }
                        }

                        if (type == "create" || type == "copy") {
                            var createdFrom = recordObj.getValue({ fieldId: "createdfrom" });
                            if (createdFrom) {
                                if (ST_FEATURE == true || ST_FEATURE == "T") {
                                    CO_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                }
                            }
                        }
                    }

                    // SuiteTax Mexico
                    if (LMRY_Result[0] == "MX") {
                        if (type == "copy" || type == "xcopy") {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                MX_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                            }
                        }

                        if (type == "create" || type == "copy") {
                            var createdFrom = recordObj.getValue({ fieldId: "createdfrom" });
                            if (createdFrom) {
                                if (ST_FEATURE == true || ST_FEATURE == "T") {
                                    MX_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                }
                            }
                        }
                    }

                    // SuiteTax Argentina
                    if (LMRY_Result[0] == "AR") {
                        if (type == "copy" || type == "xcopy") {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                AR_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                            }
                        }

                        if (type == "create" || type == "copy") {
                            var createdFrom = recordObj.getValue({ fieldId: "createdfrom" });
                            if (createdFrom) {
                                if (ST_FEATURE == true || ST_FEATURE == "T") {
                                    AR_ST_TaxLibrary.deleteTaxDetailLines(recordObj);
                                }
                            }
                        }
                    }

                    //SETEO DEL CUSTBODY LATAMREADY - BR TRANSACTION TYPE PARA FILTRAR LA COLUMNA CFOP
                    if (LMRY_Result[0] == 'BR' && LMRY_Result[2] == true && (type == 'create' || type == 'edit' || type == 'copy')) {
                        var transactionType = recordObj.getValue('custbody_lmry_br_transaction_type');
                        var createdFrom = recordObj.getValue('createdfrom');
                        //EL CREATEDFROM YA NO ESTA, AHORA SOLO CON EL COPY PUEDE SER TRANSFORMACION DESDE PO
                        if ((transactionType == '' || transactionType == null) || type == 'copy') {
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
                                    recordObj.setValue('custbody_lmry_br_transaction_type', resultTransactionType[0].getValue('internalid'));
                                }

                            }
                        }
                    }


                } // Fin if (type != 'print' && type != 'email')

            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2('[ beforeLoad ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
            return true;
        }

        /**********************************
         * beforeSubmit = Se ejecuta antes
         * de grabar la transaccion
         *********************************/
        function beforeSubmit(context) {

            try {

                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                recordObj = context.newRecord;
                type = context.type;
                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);

                // Valida que tenga acceso
                var LMRY_Result = ValidateAccessVB(subsidiary);

                var exchrate = false;
                switch (LMRY_Result[0]) {
                    case 'AR':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(532, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'BR':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(529, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CO':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(533, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'CL':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(530, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'MX':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(528, licenses)) {
                            exchrate = true;
                        }
                        break;
                    case 'PE':
                        if ((context.type == 'create' || context.type == 'copy') && library.getAuthorization(531, licenses)) {
                            exchrate = true;
                        }
                        break;
                    default:
                        break;
                }
                if (exchrate) {
                    library_ExchRate.setExchRate(context);
                }

                //Nueva logica Country WHT Lineas
                libWHTLines.beforeSubmitTransaction(context, licenses);

                // Nueva logica Retenciones Guatemala
                Library_WHT_GT.beforeSubmitTransaction(context, licenses);

                // Nueva logica de Colombia
                // switch (LMRY_Result[0]) {
                //   case 'AR':
                //     if (library.getAuthorization(200, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'BO':
                //     if (library.getAuthorization(152, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   /*case 'BR':
                //     if (library.getAuthorization(147) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;*/
                //   case 'CL':
                //     if (library.getAuthorization(201, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'CO':
                //     if (library.getAuthorization(150, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'CR':
                //     if (library.getAuthorization(203, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                // //   case 'EC':
                // //     if (library.getAuthorization(153, licenses) == true) {
                // //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                // //     }
                // //     break;
                //   case 'SV':
                //     if (library.getAuthorization(205, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'GT':
                //     if (library.getAuthorization(207, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'MX':
                //     if (library.getAuthorization(209, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'PA':
                //     if (library.getAuthorization(211, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'PY':
                //     if (library.getAuthorization(213, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'PE':
                //     if (library.getAuthorization(214, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                //   case 'UY':
                //     if (library.getAuthorization(216, licenses) == true) {
                //       Library_WHT_Transaction.beforeSubmitTransaction(context);
                //     }
                //     break;
                // }

                //NUEVO CASO RETENCIONES ECUADOR
                if (LMRY_Result[0] == 'EC' && library.getAuthorization(153, licenses) == true) {
                    Library_RetencionesEcuador.beforeSubmitTransaction(context, LMRY_Result, context.type);
                }
                var subsidiaryCountry = recordObj.getValue("custbody_lmry_subsidiary_country");
                log.debug("subsidiaryCountry", subsidiaryCountry);
                if (LMRY_Result[0] == "BR" && Number(subsidiaryCountry) == 30) {
                    if (["create", "edit", "copy"].indexOf(context.type) != -1) {
                        if (context.type == 'edit') {
                            if (ST_FEATURE === true || ST_FEATURE === "T") {
                                ST_Library_Transaction.cleanLinesforCopy(recordObj);
                            } else {
                                cleanLinesforCopy(recordObj);
                            }
                        }

                        //Eliminar Tax Results
                        var band = true;
                        var LMRY_Intern = recordObj.id;

                        //LatamTAX BR
                        if (type == 'edit' && (library.getAuthorization(147, licenses) || library.getAuthorization(527, licenses))) {

                            var typeTransaction = recordObj.type;

                            if (typeTransaction == 'vendorbill') {
                                var transaction_fields = search.create({
                                    type: 'customrecord_lmry_br_transaction_fields',
                                    columns: 'custrecord_lmry_br_block_taxes',
                                    filters: [
                                        ['custrecord_lmry_br_related_transaction', 'anyof', LMRY_Intern], 'AND', ['custrecord_lmry_br_block_taxes', 'anyof', 1]
                                    ]
                                });
                                var result_transaction_fields = transaction_fields.run().getRange(0, 1);

                                if (result_transaction_fields != null && result_transaction_fields.length > 0) {
                                    band = false;
                                }

                                if (band) {
                                    Library_WHT_Transaction.deleteTaxResults(recordObj);
                                }
                            } else {
                                Library_WHT_Transaction.deleteTaxResults(recordObj);
                            }

                        }
                    }
                }

                if (LMRY_Result[0] == 'CL') {
                    //Elimina el registro de la transaccion del record TaxResult
                    if (type == "delete") {
                        library_CL_Purchases.deleteTaxResult(LMRY_Intern);
                    }
                }

                // SuiteTax Colombia
                if (LMRY_Result[0] == "CO") {
                    if (type == "delete") {
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            CO_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                        }
                    }
                }

                // SuiteTax Mexico
                if (LMRY_Result[0] == "MX") {
                    if (type == "delete") {
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            MX_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                        }
                    }
                }

                // SuiteTax Argentina
                if (LMRY_Result[0] == "AR") {
                    if (type == "delete") {
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            AR_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                        }
                    }
                }

                //SETEO DE CAMPOS BASE 0%, 12% Y 14%
                var eventsEC = ['create', 'copy', 'edit'];
                if (LMRY_Result[0] == 'EC' && library.getAuthorization(42, licenses) && eventsEC.indexOf(type) != -1) {
                    libraryEcBaseAmounts.setBaseAmounts(recordObj, '1');
                }


            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2('[ beforeSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
            return true;
        }

        /**********************************
         * afterSubmit = Se ejecuta despues
         * de grabar la transaccion
         *********************************/
        function afterSubmit(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: "tax_overhauling"
                });
                // Tipo de Contexto en el que se ejecuta, puedemn ser: USEREVENT, MAPREDUCE, USERINTERFACE, etc
                var type_interface = runtime.executionContext;
                // type = tipo Create, Edit , Delete
                type = context.type;
                // newRecord = Referencia al registro
                recordObj = context.newRecord;
                // id = Internal ID de la transaccion
                var LMRY_Intern = recordObj.id;
                // form = Formulario en ejecucion
                var form = context.form;
                // Subsidiaria de la transaccion
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);
                // Validacion de Acceso a Features
                var LMRY_Result = ValidateAccessVB(subsidiary);

                // Para validar si ingresa al log
                // log.debug({
                //   title: 'afterSubmit',
                //   details: 'context.type: ' + context.type + ' - ' + LMRY_Intern
                // });

                // Se ejecuta si se elimina el registro
                if (type == 'delete') {
                    // Para Argentina - AR - WHT Payment
                    if (LMRY_Result[0] == 'AR') {
                        if (library.getAuthorization(138, licenses)) {
                            // Elimina registros
                            DeleteGroupLine(LMRY_Intern);
                        }
                    }
                    // Para Colombia Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'CO') {
                        if (library.getAuthorization(27, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorcredit', LMRY_Intern);
                        }
                    }
                    // Bolivia - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'BO') {
                        if (library.getAuthorization(46, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorcredit', LMRY_Intern);
                        }
                    }
                    // Paraguay - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'PY') {
                        if (library.getAuthorization(47, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorcredit', LMRY_Intern);
                        }
                    }
                    if (LMRY_Result[0] == 'CL') {
                        if (library.getAuthorization(628, licenses)) {
                            // Elimina registros
                            library_CL_Purchases.deleteGeneratedRecords(recordObj);
                        }
                    }
                }


                if (type == 'create' || type == 'edit' || type == 'copy') {
                    var transactionType = 'vendorbill';
                    //LatamTAX BR
                    if (type == 'edit' && LMRY_Result[0] == 'BR' && (library.getAuthorization(147, licenses) || library.getAuthorization(527, licenses))) {
                        record.submitFields({
                            type: transactionType,
                            id: LMRY_Intern,
                            values: {
                                'custbody_lmry_scheduled_process': false,
                            },
                            options: {
                                disableTriggers: true
                            }
                        });
                    }
                    libWHTLines.afterSubmitTransaction(context, type, LMRY_Intern, transactionType, licenses);
                }

                // Se ejecuta si es diferente de eliminar
                if (type != 'delete') {
                    // Actualiza los campos
                    var LMRY_countr = library.Get_Country_STLT(subsidiary);
                    /******************************
                     * Solo para localizacion :
                     *  - Peruana = PE
                     *  - Brasil = BR
                     *****************************/
                    if (LMRY_countr[0] == 'PE' ||
                        LMRY_countr[0] == 'BR') {
                        // Validacion de Features & Country
                        swFeature = false;
                        if (LMRY_countr[0] == 'PE' && library.getAuthorization(136, licenses)) {
                            swFeature = true;
                        }
                        if (LMRY_countr[0] == 'BR' && library.getAuthorization(140, licenses)) {
                            swFeature = true;
                        }

                        // Solo si es verdadero
                        var type_interface = runtime.executionContext;
                        var typeInterfaces = ['USEREVENT', 'SCHEDULED'];
                        if (swFeature == true && typeInterfaces.indexOf(type_interface) == -1) {
                            var appliesto = recordObj.getValue({
                                fieldId: 'custpage_4601_appliesto'
                            });
                            var witaxamount = recordObj.getValue({
                                fieldId: 'custpage_4601_witaxamount'
                            });

                            var witaxbaseamount = recordObj.getValue({
                                fieldId: 'custpage_4601_witaxbaseamount'
                            });

                            //Solo aparece con Applies to = Total Amount (T)
                            var witaxcode = recordObj.getValue({
                                fieldId: 'custpage_4601_witaxcode'
                            });
                            if (appliesto == false || appliesto == 'F' || witaxcode === undefined) {
                                witaxcode == null;
                            }
                            var witaxrate = recordObj.getValue({
                                fieldId: 'custpage_4601_witaxrate'
                            });

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
                             * - Latam Wtax Code Descripcion
                             * - Latam WTax Rate
                             * - Latam Wtax Amount
                             * - Latam WBase Amount
                             ***********************************/
                            var otherId = record.submitFields({
                                type: 'vendorbill',
                                id: LMRY_Intern,
                                values: {
                                    'custbody_lmry_wtax_code': witaxcode,
                                    'custbody_lmry_wtax_rate': witaxrate,
                                    'custbody_lmry_wtax_amount': witaxamount,
                                    'custbody_lmry_wbase_amount': witaxbaseamount
                                },
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                        } // Validacion de Features

                    } // Solo para localizacion
                } // Diferente de Delete

                // Solo si la transaccion es Creada, Editada y/o Copiada
                if (type == 'create' || type == 'edit' || type == 'copy') {

                    if (LMRY_Result[0] == 'MX' && library.getAuthorization(243, licenses) == true) {
                        LibraryTransferIva.generateMXTransField(context);
                    }

                    //Nueva logica para Chile
                    if (LMRY_Result[0] == 'CL') {
                        // var recordCL = recordObj;
                        var recordCL = record.load({
                            type: "vendorbill",
                            id: recordObj.id
                        });
                        if (library.getAuthorization(627, licenses) == true) {
                            var context = {
                                type: context.type,
                                newRecord: recordCL
                            };
                            if ((ST_FEATURE) && (ST_FEATURE === true || ST_FEATURE === 'T')) {
                                library_CL_Purchases.afterSubmitTransaction(context, licenses);
                                recordCL.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            }
                        }
                    }

                    // SuiteTax Colombia
                    if (LMRY_Result[0] == "CO") {
                        var recordCO = record.load({
                            type: "vendorbill",
                            id: recordObj.id
                        });

                        if (library.getAuthorization(643, licenses) == true) {
                            var contextCO = {
                                type: context.type,
                                newRecord: recordCO
                            };

                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                CO_ST_TaxLibrary.setTaxTransaction(contextCO);
                                recordCO.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            }
                        }
                    }

                    if (LMRY_Result[0] == "MX") {
                        var recordMX = record.load({
                            type: 'vendorbill',
                            id: recordObj.id
                        });

                        if (library.getAuthorization(671, licenses) == true) {
                            var contextMX = {
                                type: context.type,
                                newRecord: recordMX
                            };

                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                MX_ST_TaxLibrary.setTaxTransaction(contextMX);
                                recordMX.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            }
                        }
                    }

                    // SuiteTax Argentina
                    if (LMRY_Result[0] == "AR") {
                        var recordAR = record.load({
                            type: 'vendorbill',
                            id: recordObj.id
                        });
                        // Calculo de Impuestos
                        if (library.getAuthorization(678, licenses) == true) {
                            var contextAR = {
                                type: context.type,
                                newRecord: recordAR
                            };

                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                AR_ST_TaxLibrary.setTaxTransaction(contextAR);
                                recordAR.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            }
                        }
                        // Transaction Fields AR
                        if (library.getAuthorization(138, licenses) == true) {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                AR_ST_WhtLibrary.setTransactionFields(context, recordAR);
                            }
                        }
                    }

                }

                if (type == 'create' || type == 'edit') {
                    // Nueva logica Retenciones Guatemala
                    Library_WHT_GT.afterSubmitTransaction(type, recordObj.id, recordObj.type, licenses);

                    // Para Mexico
                    if (LMRY_Result[0] == 'MX') {
                        if (library.getAuthorization(151, licenses) == true) {
                            // Abre la transaccion solo al crear
                            if (type == 'create') {
                                recordObj = record.load({
                                    type: recordObj.type,
                                    id: recordObj.id,
                                    isDynamic: false
                                });
                            }
                            // para carga de la DIOT
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                MX_ST_DIOT_Library.CalculoDIOT(recordObj)
                            } else {
                                libraryDIOT.CalculoDIOT(recordObj);
                            }
                        }

                        if (library.getAuthorization(20, licenses) == true) {
                            // Libera transaccion
                            //27-01-21: Se renombro el campo y se usa para los anticipos BR
                            /*var otherId = record.submitFields({
                              type: 'vendorbill',
                              id: LMRY_Intern,
                              values: {
                                'custbody_lmry_diot_iva_procesado': 2
                              }
                            });*/
                        }
                    }
                    // *************************   Modificacion 6 de Setiembre 2019    ********************
                    // Decripcion: Si hay acceso y los VendorBill estan aprobados se genera las retenciones


                    //variable approvalStatus del campo APPROVAL STATUS del BILL
                    var approvalStatus = 0;
                    approvalStatus = recordObj.getValue({
                        fieldId: 'approvalstatus'
                    });

                    // Para Colombia - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'CO') {
                        if (library.getAuthorization(27, licenses) && approvalStatus == 2) {
                            // Aplicacion de WHT Latam
                            library1.Create_WHT_Latam('vendorbill', LMRY_Intern);
                        }
                    }
                    // Para Colombia - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'BO') {
                        if (library.getAuthorization(46, licenses) && approvalStatus == 2) {
                            // Aplicacion de WHT Latam
                            library1.Create_WHT_Latam('vendorbill', LMRY_Intern);
                        }
                    }
                    // Para Paraguay - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'PY') {
                        if (library.getAuthorization(47, licenses) && approvalStatus == 2) {
                            // Aplicacion de WHT Latam
                            library1.Create_WHT_Latam('vendorbill', LMRY_Intern);
                        }
                    }
                    //******************* Fin de Modificacion 6 de Setiembre 2019 ***************************

                }

                /******************************
                 * Nueva logica de colombia
                 * para los siguientes paises
                 ******************************/
                // switch (LMRY_Result[0]) {
                //   case 'AR':
                //     if (library.getAuthorization(200, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'BO':
                //     if (library.getAuthorization(152, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   /*case 'BR':
                //     if (library.getAuthorization(147) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;*/
                //   case 'CL':
                //     if (library.getAuthorization(201, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'CO':
                //     if (library.getAuthorization(150, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'CR':
                //     if (library.getAuthorization(203, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                // //   case 'EC':
                // //     if (library.getAuthorization(153, licenses) == true) {
                // //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                // //     }
                // //     break;
                //   case 'SV':
                //     if (library.getAuthorization(205, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                // //   case 'GT':
                // //     if (library.getAuthorization(207, licenses) == true) {
                // //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                // //     }
                // //     break;
                //   case 'MX':
                //     if (library.getAuthorization(209, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'PA':
                //     if (library.getAuthorization(211, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'PY':
                //     if (library.getAuthorization(213, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'PE':
                //     if (library.getAuthorization(214, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                //   case 'UY':
                //     if (library.getAuthorization(216, licenses) == true) {
                //       Library_WHT_Transaction.afterSubmitTransaction(context, true);
                //     }
                //     break;
                // }

                // Solo al momento de Crear o Editar
                if (type == 'create' || type == 'edit') {
                    /***********************************
                     * Solo si tiene el Feature activo
                     * AR - PERCEPCIONES PURCHASE
                     ***********************************/
                    if (LMRY_Result[0] == 'AR' && library.getAuthorization(218, licenses)) {
                        // Logica Percepcion Opus
                        var arreglo_item = new Array();
                        var arreglo_amount = new Array();
                        var arreglo_class = new Array();
                        var arreglo_location = new Array();
                        var arreglo_department = new Array();

                        // Solo para la sublista Items
                        var cantidad_items = recordObj.getLineCount({
                            sublistId: 'item'
                        });
                        if (cantidad_items > 0) {
                            for (var i = 0; i < cantidad_items; i++) {
                                var columna_tributo = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_ar_item_tributo',
                                    line: i
                                });
                                if (columna_tributo) {
                                    var name_item = recordObj.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'item',
                                        line: i
                                    });
                                    var amount = recordObj.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'amount',
                                        line: i
                                    });
                                    var clase = recordObj.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'class',
                                        line: i
                                    });
                                    var departamento = recordObj.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'department',
                                        line: i
                                    });
                                    var ubicacion = recordObj.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'location',
                                        line: i
                                    });
                                    arreglo_item.push(name_item);
                                    arreglo_class.push(clase);
                                    arreglo_department.push(departamento);
                                    arreglo_location.push(ubicacion);
                                    arreglo_amount.push(amount);
                                }
                            }

                            /***********************************
                             * Trae los regitros configurados
                             * en el registro personalizado
                             * LatamReady - Percepcion Purchase
                             **********************************/
                            var search_opus = search.create({
                                type: 'customrecord_lmry_percepcion_purchase',
                                columns: ['custrecord_lmry_percepcion_item1', 'custrecord_lmry_percepcion_item2',
                                    'custrecord_lmry_percepcion_taxcode', 'custrecord_lmry_percepcion_subsidiary'
                                ],
                                filters: [{
                                    name: 'isinactive',
                                    operator: 'is',
                                    values: ['F']
                                }]
                            });
                            // Trae los primeros 1000 registros
                            var result_opus = search_opus.run().getRange(0, 1000);
                            // Solo si esta configurado
                            if (result_opus != null && result_opus.length > 0) {
                                /**************************************
                                 * Actualiza el Vendor Bill - Grabado
                                 *************************************/
                                var mirror_record = record.load({
                                    type: recordObj.type,
                                    id: recordObj.id,
                                    isDynamic: false
                                });

                                // Barrido del arreglo arreglo_item
                                for (var j = 0; j < arreglo_item.length; j++) {
                                    // Seteo de Segmentacion
                                    for (var k = 0; k < result_opus.length; k++) {
                                        // Solo si el item es de percepcion
                                        if (arreglo_item[j] == result_opus[k].getValue("custrecord_lmry_percepcion_item1")) {
                                            var amount = parseFloat(arreglo_amount[j]) * (-1);
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'item',
                                                line: cantidad_items,
                                                value: result_opus[k].getValue("custrecord_lmry_percepcion_item2")
                                            });
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_lmry_ar_item_tributo',
                                                line: cantidad_items,
                                                value: false
                                            });
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'amount',
                                                line: cantidad_items,
                                                value: amount
                                            });
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'quantity',
                                                line: cantidad_items,
                                                value: '1'
                                            });
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'rate',
                                                line: cantidad_items,
                                                value: arreglo_amount[j]
                                            });
                                            mirror_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'taxcode',
                                                line: cantidad_items,
                                                value: result_opus[k].getValue("custrecord_lmry_percepcion_taxcode")
                                            });
                                            if (arreglo_location[j] != null && arreglo_location[j] != '') {
                                                mirror_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'location',
                                                    line: cantidad_items,
                                                    value: arreglo_location[j]
                                                });
                                            }
                                            if (arreglo_class[j] != null && arreglo_class[j] != '') {
                                                mirror_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'class',
                                                    line: cantidad_items,
                                                    value: arreglo_class[j]
                                                });
                                            }
                                            if (arreglo_department[j] != null && arreglo_department[j] != '') {
                                                mirror_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'department',
                                                    line: cantidad_items,
                                                    value: arreglo_department[j]
                                                });
                                            }
                                            // Siguiente Linea
                                            cantidad_items++;
                                        } // //Fin :  Solo si el item es de percepcion
                                    } // Fin : Segmentacion
                                } // Fin : arreglo_item

                                // Graba Record
                                mirror_record.save({
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true,
                                    enableSourcing: true
                                });
                            } // Solo si esta configurado
                        } // Solo si tiene Items
                    } // Solo Feature 218

                    /***********************************
                     * Solo si tiene el Feature activo
                     * AR - WHT Payment
                     ***********************************/
                    if (LMRY_Result[0] == 'AR') {
                        if (library.getAuthorization(138, licenses)) {
                            if (ST_FEATURE == false || ST_FEATURE == "F") {
                                GroupLine(context, LMRY_Intern);
                            }
                        }
                    } // Solo AR - SUM TAX CODE GROUP
                } // Solo Crear o Editar


                //GL IMPACT POPUP
                if ((type == 'create' || type == 'edit') && LMRY_Result[0] == 'BR' && library.getAuthorization(290, licenses) == true) {
                    library_GLImpact_Popup.afterSubmit_GLpopup(context);
                }

                /*********************** MODIFICACIÓN *****************************************************
                  - Fecha: 23/10/2020
                  - Descripción: Cálculo de IGV y creación de Journal
                ******************************************************************************************/

                if ((type == 'create' || type == 'edit' || type == 'copy') && LMRY_Result[0] == 'PE' && LMRY_Result[2] == true) {
                    if (type == 'edit') {
                        var listJournal = [];
                        var JournalSearchObj = search.create({
                            type: "journalentry",
                            filters: [
                                ["custbody_lmry_reference_transaction", "is", LMRY_Intern],
                                "AND", ["mainline", "is", "T"]
                            ],
                            columns: ['internalid']
                        });
                        JournalSearchObj = JournalSearchObj.run().getRange(0, 1000);

                        if (JournalSearchObj != null && JournalSearchObj != '') {
                            for (var i = 0; i < JournalSearchObj.length; i++) {
                                if (listJournal.indexOf(JournalSearchObj[i].getValue('internalid')) == -1) {
                                    record.delete({
                                        type: 'journalentry',
                                        id: JournalSearchObj[i].getValue('internalid')
                                    });
                                    listJournal.push(JournalSearchObj[i].getValue('internalid'))
                                }

                            }
                        }
                    }

                    //Verificar si existe LatamReady - PE Transaction Fields anexado a la transacción
                    var deleted = false;
                    var peTransField = search.create({
                        type: "customrecord_lmry_pe_transaction_fields",
                        filters: [
                            ["custrecord_lmry_pe_transaction_related", "is", LMRY_Intern],
                            "AND", ["isinactive", "is", "F"]
                        ],
                        columns: ['internalid']
                    });

                    peTransField = peTransField.run().getRange(0, 1);
                    if (peTransField != null && peTransField != '') {

                        record.delete({
                            type: 'customrecord_lmry_pe_transaction_fields',
                            id: peTransField[0].getValue('internalid')
                        });

                    }

                    var amountIGV = '';
                    var applywht = recordObj.getValue({
                        fieldId: 'custbody_lmry_apply_wht_code'
                    });
                    if (applywht == 'T' || applywht == true) {
                        var igvAccount = 0;
                        var igvAccountOrig = 0;
                        var currencySetup = 0;
                        var igvPercent = 0;
                        var billSearchObj = search.create({
                            type: "customrecord_lmry_setup_tax_subsidiary",
                            filters: [
                                ["custrecord_lmry_setuptax_subsidiary", "is", subsidiary],
                                "AND", ["isinactive", "is", "F"]
                            ],
                            columns: ['custrecord_lmry_setuptax_pe_igv_account', 'custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_pe_igv_percent', 'custrecord_lmry_setuptax_pe_igv_acc_orig']
                        });
                        billSearchObj = billSearchObj.run().getRange(0, 1000);

                        if (billSearchObj != null && billSearchObj != '') {
                            igvAccount = billSearchObj[0].getValue('custrecord_lmry_setuptax_pe_igv_account');
                            igvAccountOrig = billSearchObj[0].getValue('custrecord_lmry_setuptax_pe_igv_acc_orig') || 0;
                            currencySetup = billSearchObj[0].getValue('custrecord_lmry_setuptax_currency');
                            igvPercent = billSearchObj[0].getValue('custrecord_lmry_setuptax_pe_igv_percent');
                            if (igvPercent) {
                                igvPercent = parseFloat(igvPercent);
                            }
                        }

                        var exchangeRate = 1;
                        var featureMB = runtime.isFeatureInEffect({
                            feature: "MULTIBOOK"
                        });

                        var featureSubs = runtime.isFeatureInEffect({
                            feature: "SUBSIDIARIES"
                        });
                        if (featureSubs && featureMB) { // OneWorld y Multibook
                            var currencySubs = search.lookupFields({
                                type: 'subsidiary',
                                id: subsidiary,
                                columns: ['currency']
                            });
                            currencySubs = currencySubs.currency[0].value;

                            if (currencySubs != currencySetup && currencySetup != '' && currencySetup != null) {
                                var lineasBook = recordObj.getLineCount({
                                    sublistId: 'accountingbookdetail'
                                });
                                if (lineasBook != null && lineasBook != '') {
                                    for (var i = 0; i < lineasBook; i++) {
                                        var lineaCurrencyMB = recordObj.getSublistValue({
                                            sublistId: 'accountingbookdetail',
                                            fieldId: 'currency',
                                            line: i
                                        });
                                        if (lineaCurrencyMB == currencySetup) {
                                            exchangeRate = recordObj.getSublistValue({
                                                sublistId: 'accountingbookdetail',
                                                fieldId: 'exchangerate',
                                                line: i
                                            });
                                            break;
                                        }
                                    }
                                }
                            } else { // La moneda de la subsidiaria es igual a la moneda del setup
                                exchangeRate = recordObj.getValue({
                                    fieldId: 'exchangerate'
                                });
                            }
                        } else { // No es OneWorld o no tiene Multibook
                            exchangeRate = recordObj.getValue({
                                fieldId: 'exchangerate'
                            });
                        }

                        var idJournal = 0;
                        var JEamount = 0;

                        var featureAprove = runtime.getCurrentScript().getParameter({
                            name: 'CUSTOMAPPROVALJOURNAL'
                        });
                        var concepDetr = recordObj.getValue('custbody_lmry_document_type');
                        //Legal Document Type NO DOMICILIADO
                        if (concepDetr == 354) {

                            var cantItem = recordObj.getLineCount('item');

                            //Se crea objeto para setear valor de columna LATAM - CL NON-RECOVERABLE VAT AMOUNT
                            var rcd_VendorBill = record.load({
                                type: recordObj.type,
                                id: recordObj.id,
                                isDynamic: false
                            });

                            for (var j = 0; j < cantItem; j++) {
                                if (!recordObj.getSublistValue('item', 'custcol_4601_witaxline', j)) {
                                    //Valor IGV en líneas
                                    var JEamountLine = parseFloat(recordObj.getSublistValue('item', 'amount', j)) * exchangeRate * igvPercent / 100;
                                    JEamountLine = Math.round(JEamountLine * 100) / 100;

                                    if (JEamountLine) {
                                        rcd_VendorBill.setSublistValue('item', 'custcol_lmry_monto_iva_no_recup_cl', j, JEamountLine);
                                    } else {
                                        rcd_VendorBill.setSublistValue('item', 'custcol_lmry_monto_iva_no_recup_cl', j, 0);
                                    }

                                    //Valor IGV cabecera
                                    JEamount += parseFloat(JEamountLine);
                                    JEamount = Math.round(JEamount * 100) / 100;
                                }
                            }

                            rcd_VendorBill.save({
                                ignoreMandatoryFields: true,
                                disableTriggers: true,
                                enableSourcing: true
                            });

                            if (JEamount) {
                                amountIGV = JEamount;

                                if (igvAccount) {
                                    var newJournal = record.create({
                                        type: record.Type.JOURNAL_ENTRY
                                    });

                                    if (subsidiary) {
                                        newJournal.setValue('subsidiary', subsidiary);
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
                                    newJournal.setValue('currency', currencySetup);
                                    newJournal.setValue('exchangerate', exchangeRate);
                                    newJournal.setValue('memo', 'Calculo de IGV - Bill ID: ' + LMRY_Intern);

                                    // Segmentation
                                    var lineDep = recordObj.getSublistValue('item', 'department', 0);
                                    var lineCla = recordObj.getSublistValue('item', 'class', 0);
                                    var lineLoc = recordObj.getSublistValue('item', 'location', 0);
                                    // Line from
                                    if (igvAccountOrig) {
                                        newJournal.setSublistValue('line', 'account', 0, igvAccountOrig);
                                    } else {
                                        newJournal.setSublistValue('line', 'account', 0, recordObj.getValue('account'));
                                    }
                                    newJournal.setSublistValue('line', 'credit', 0, JEamount);
                                    newJournal.setSublistValue('line', 'memo', 0, 'IGV Amount');
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
                                    newJournal.setSublistValue('line', 'account', 1, igvAccount);
                                    newJournal.setSublistValue('line', 'debit', 1, JEamount);
                                    newJournal.setSublistValue('line', 'memo', 1, 'IGV Amount');
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

                                    if (idJournal) {
                                        var peTranFieldObj = record.create({
                                            type: 'customrecord_lmry_pe_transaction_fields'
                                        });

                                        peTranFieldObj.setValue({
                                            fieldId: 'custrecord_lmry_pe_transaction_related',
                                            value: LMRY_Intern
                                        });
                                        peTranFieldObj.setValue({
                                            fieldId: 'custrecord_lmry_pe_igv_wht_amount',
                                            value: JEamount
                                        });
                                        peTranFieldObj.setValue({
                                            fieldId: 'custrecord_lmry_pe_reference_journal',
                                            value: idJournal
                                        });
                                        peTranFieldObj.save({
                                            enableSourcing: true,
                                            ignoreMandatoryFields: true,
                                            disableTriggers: true
                                        });
                                    }
                                }
                            }
                        }
                    }
                    record.submitFields({
                        type: 'vendorbill',
                        id: LMRY_Intern,
                        values: {
                            'custbody_lmry_monto_retencion_igv': amountIGV
                        },
                        options: {
                            disableTriggers: true
                        }
                    });
                }

            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2('[ afterSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
            return true;
        }

        /* ------------------------------------------------------------------------------------------------------
         * Elimina la agrupacion del registro personalizado LatamReady - Setup Tax Code Group.
         * --------------------------------------------------------------------------------------------------- */
        function DeleteGroupLine(recordID) {
            try {
                /**********************************
                 * Valida si no existe en el record
                 * LatamReady - Transaction Fields
                 * en el caso de existir Elimina
                 **********************************/
                var tax_group = search.create({
                    type: 'customrecord_lmry_transactions_fields',
                    columns: ['internalid', 'custrecord_lmry_transaction_f'],
                    filters: [{
                        name: 'custrecord_lmry_transaction_f_id',
                        operator: 'equalto',
                        values: recordID
                    }]
                });
                // Trae los primeros 1000 registros
                var result_tax = tax_group.run().getRange(0, 1000);

                // Valida si ya se grabo
                if (result_tax != null && result_tax.length > 0) {
                    // Para validar si ingresa al log
                    // log.debug({
                    //   title: 'DeleteGroupLine : result_tax',
                    //   details: result_tax[0].getValue('internalid')
                    // });

                    // Eliminacion de Records
                    for (var delLine = 0; delLine < result_tax.length; delLine++) {
                        // Elimina el del regisotr personalizado
                        var delRecord = record.delete({
                            type: 'customrecord_lmry_transactions_fields',
                            id: result_tax[delLine].getValue('internalid'),
                        });
                    } // Eliminacion de Records

                    // Para validar si ingresa al log
                    // log.debug({
                    //   title: 'Delete Record Line',
                    //   details: delRecord
                    // });

                } // Valida si ya se grabo
            } catch (err) {
                library.sendemail2('[ beforeSubmit - DeleteGroupLine ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
            return true;
        }

        /* ------------------------------------------------------------------------------------------------------
         * Realiza la agrupacion de las lienas de la transacion segun la configuracion del registros
         * personalizado LatamReady - Setup Tax Code Group.
         * --------------------------------------------------------------------------------------------------- */
        function GroupLine(context, Record_ID) {
            try {
                // Registro Actualiza
                var recordObj = context.newRecord

                // Si edita lo elimina
                if (context.type != 'create') {
                    // Elimina registros
                    DeleteGroupLine(Record_ID);
                }

                // Declaracion de Arreglos
                var arr_DatFil = [];
                var arr_PosFil = -1;

                /***********************************
                 * Trae los regitros configurados
                 * en el registro personalizado
                 * LatamReady - Setup Tax Code Group
                 **********************************/
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

                // Trae los primeros 1000 registros
                var result_grps = tax_group.run().getRange(0, 1000);
                // Solo si esta configurado TAX Group
                if (result_grps != null && result_grps.length > 0) {
                    // Inicio Barrido del grupo de impuestos
                    for (var TaxLine = 0; TaxLine < result_grps.length; TaxLine++) {
                        // Declaracion de JSON y Arreglo Tax Group
                        var arr_DatCol = {};
                        arr_DatCol["TaxGroup"] = ''; // Latam - Tax Code Group
                        arr_DatCol["TaxCodes"] = ''; // Latam - Tax Code
                        arr_DatCol["TaxField"] = ''; // Latam - Setup ID Custbody
                        arr_DatCol["TaxBase"] = ''; // Latam - Setup Amount To
                        arr_DatCol["TaxAmoun"] = 0; // Amount

                        // Captura Columnas
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

                        /*******************************
                         * Solo para la sublista Expense
                         *******************************/
                        var cantidad_expen = recordObj.getLineCount({
                            sublistId: 'expense'
                        });
                        if (cantidad_expen > 0) {
                            for (var ExpeLine = 0; ExpeLine < cantidad_expen; ExpeLine++) {
                                var lin_taxcode = recordObj.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'taxcode',
                                    line: ExpeLine
                                });
                                var lin_amounts = recordObj.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: baseBill,
                                    line: ExpeLine
                                });
                                // Compara codigos de impuesto
                                if (arr_DatCol.TaxCodes == lin_taxcode) {
                                    arr_RowSws = true;
                                    arr_DatCol.TaxAmoun = parseFloat(arr_DatCol.TaxAmoun) + parseFloat(lin_amounts);
                                }
                            }
                        } // Solo para la sublista Expense

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
            } catch (errmsg) {
                recordObj = context.newRecord;
                library.sendemail2('[ afterSubmit - GroupLine ] ' + errmsg, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
        }

        /* ------------------------------------------------------------------
         * A la variable FeatureID se le asigna el valore que le corresponde
         *  y si tiene activo el enabled feature access.
         * --------------------------------------------------------------- */
        function ValidateAccessVB(ID) {
            var LMRY_access = false;
            var LMRY_countr = new Array();
            var LMRY_Result = new Array();

            try {

                // Inicializa variables Locales y Globales
                LMRY_countr = library.Validate_Country(ID);

                // Verifica que el arreglo este lleno
                if (LMRY_countr.length < 1) {
                    LMRY_Result[0] = '';
                    LMRY_Result[1] = '-None-';
                    LMRY_Result[2] = LMRY_access;
                    return true;
                }

                LMRY_access = library.getCountryOfAccess(LMRY_countr, licenses);

                // Asigna Valores
                LMRY_Result[0] = LMRY_countr[0]; //MX
                LMRY_Result[1] = LMRY_countr[1]; //Mexico
                LMRY_Result[2] = LMRY_access;
                LMRY_Result = activate_fe(LMRY_Result, licenses);
            } catch (err) {
                library.sendemail2('[ ValidateAccessVB ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }

            return LMRY_Result;
        }

        /* ------------------------------------------------------------------
         * Funcion activate_fe para activar features del bill.
         * --------------------------------------------------------------- */
        function activate_fe(fe_countr, licenses) {
            var autfe = false;
            var authorizations_fe = {
                'AR': 260,
                'BO': 261,
                'BR': 262,
                'CL': 263,
                'CO': 264,
                'CR': 265,
                'EC': 266,
                'SV': 267,
                'GT': 268,
                'MX': 269,
                'PA': 270,
                'PY': 271,
                'PE': 272,
                'UY': 273,
                'NI': 408,
                'DO': 401
            };

            if (authorizations_fe[fe_countr[0]]) {
                autfe = library.getAuthorization(authorizations_fe[fe_countr[0]], licenses);
            }

            if (autfe == true) {
                fe_countr.push(true);
            } else {
                fe_countr.push(false);
            }
            return fe_countr;
        }

        function cleanLinesforCopy(RCD_TRANS) {
            try {
                var numLineas = RCD_TRANS.getLineCount({
                    sublistId: 'item'
                });

                var featureSuiteTax = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });

                var featureMultiPrice = runtime.isFeatureInEffect({
                    feature: 'multprice'
                });

                RCD_TRANS.setValue({
                    fieldId: 'custbody_lmry_informacion_adicional',
                    value: ''
                });

                for (var i = 0; i < numLineas; i++) {

                    var isItemTax = RCD_TRANS.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_lmry_ar_item_tributo',
                        line: i
                    });
                    if (!isItemTax || isItemTax == 'F') {
                        RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_taxc_rsp', i, '');

                        if (RCD_TRANS.getSublistField({
                                sublistId: 'item',
                                fieldId: 'custcol_lmry_br_freight_val',
                                line: i
                            })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_freight_val', i, '');
                        }

                        if (RCD_TRANS.getSublistField({
                                sublistId: 'item',
                                fieldId: 'custcol_lmry_br_insurance_val',
                                line: i
                            })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_insurance_val', i, '');
                        }

                        if (RCD_TRANS.getSublistField({
                                sublistId: 'item',
                                fieldId: 'custcol_lmry_br_expens_val',
                                line: i
                            })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_expens_val', i, '');
                        }

                        var base_amount = RCD_TRANS.getSublistValue('item', 'custcol_lmry_br_base_amount', i); //base_amount es el nuevo net
                        if (base_amount) {
                            var quantityItem = RCD_TRANS.getSublistValue('item', 'quantity', i);
                            quantityItem = parseFloat(quantityItem);
                            var rateItem = parseFloat(base_amount) / quantityItem;

                            if (featureMultiPrice == true || featureMultiPrice == 'T') {
                                RCD_TRANS.setSublistValue('item', 'price', i, -1);
                            }
                            RCD_TRANS.setSublistValue('item', 'rate', i, round2(rateItem));
                            RCD_TRANS.setSublistValue('item', 'amount', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');
                            if (featureSuiteTax === false || featureSuiteTax === "F") {
                                RCD_TRANS.setSublistValue('item', 'tax1amt', i, 0);
                            } else {
                                RCD_TRANS.setSublistValue('item', 'taxamount', i, 0);

                                RCD_TRANS.removeLine({
                                    sublistId: 'taxdetails',
                                    line: 0
                                });
                            }

                        }
                    }
                }

                //deleteTaxLines(RCD_TRANS);

            } catch (error) {
                log.error('[cleanLinesforCopy]', error);
            }
            return true;
        }

        function round2(num) {
            return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-14) / 1e2);
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });
