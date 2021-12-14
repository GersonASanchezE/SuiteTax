/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_VendorCreditURET_V2.0.js		                ||
||  			                                                      ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 14 2018  LatamReady    User Event 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/ui/serverWidget', 'N/search', 'N/runtime', 'N/log', 'N/config',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_libWhtValidationLBRY_V2.0',
        './Latam_Library/LMRY_libDIOTLBRY_V2.0', './Latam_Library/LMRY_GLImpact_LBRY_V2.0',
        './WTH_Library/LMRY_TAX_TransactionLBRY_V2.0', './WTH_Library/LMRY_Country_WHT_Lines_LBRY_V2.0',
        './Latam_Library/LMRY_HideView3LBRY_V2.0', './Latam_Library/LMRY_ExchangeRate_LBRY_V2.0',
        './WTH_Library/LMRY_EC_BaseAmounts_TaxCode_LBRY', './Latam_Library/LMRY_CO_ST_Purchase_Tax_Transaction_LBRY_V2.0',
        './Latam_Library/LMRY_MX_ST_Purchase_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_MX_ST_DIOT_LBRY_V2.0',
        './Latam_Library/LMRY_CO_ST_BillCredit_WHT_Lines_LBRY_V2.0' 
    ],

    function(record, serverWidget, search, runtime, log, config, library, library1, libraryDIOT, libraryGLImpact,
        Library_WHT_Transaction, libWHTLines, library_hideview3, library_ExchRate,
        libraryEcBaseAmounts, CO_ST_TaxLibrary, MX_ST_TaxLibrary, MX_ST_DIOT_Library, CO_ST_WhtLibrary) {

        var LMRY_script = 'LatamReady - Vendor Credit URET V2.0';
        var type = '';
        var isURET = true;
        var recordObj = null;
        var licenses = [];

        var ST_FEATURE = false;

        function beforeLoad(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

                var type_interface = runtime.executionContext;
                if (type_interface == 'MAPREDUCE') {
                    return true;
                }

                recordObj = context.newRecord;
                type = context.type;
                var country = new Array();
                country[0] = '';
                country[1] = '';


                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                if (ST_FEATURE == true || ST_FEATURE == 'T') {
                    if (['create', 'edit', 'copy'].indexOf(context.type) != -1) {
                        MX_ST_TaxLibrary.disableInvoicingIdentifier(context);
                    }
                }

                //Carga el Array de licencias
                licenses = library.getLicenses(subsidiary);
                if (licenses == null || licenses == '') {
                    licenses = [];
                    library_hideview3.PxHide(form, '', recordObj.type);
                    library_hideview3.PxHideSubTab(form, '', recordObj.type);
                    library_hideview3.PxHideColumn(form, '', recordObj.type);
                }

                if (context.type == 'create') {

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
                    try {
                        if (subsidiary == '' || subsidiary == null || subsidiary === undefined) {
                            var userS = runtime.getCurrentUser();
                            subsidiary = userS.subsidiary;
                        }

                        if (subsidiary != '' && subsidiary != null && subsidiary !== undefined) {
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

                        //Se obtiene el feature de General Preferencpara saber si se debe de ocultar
                        //Las columnas, los Cust Bodys y las Sublist.
                        var hide_transaction = library.getHideView(country, 2, licenses);
                        var hide_sublist = library.getHideView(country, 5, licenses);
                        var hide_column = library.getHideView(country, 3, licenses);

                        //Nombre de la transaccion
                        var typeCreate = recordObj.type;

                        //Proceso para hacer HideView para el create
                        //getCountryOfAccess Verifica si el feature localizacion de LatamReady Feature está activado.
                        if (library.getCountryOfAccess(country, licenses)) {
                            if (hide_column == true) {
                                //Oculta los campos Column
                                library_hideview3.PxHideColumn(form, country[0], typeCreate);
                            }

                            if (hide_sublist == true) {
                                //Oculta los campos Cust Record
                                library_hideview3.PxHideSubTab(form, country[0], typeCreate);
                            }

                            if (hide_transaction == true) {
                                //Oculta los campos Body
                                library_hideview3.PxHide(form, country[0], typeCreate);
                            }
                            //Si no está activado se mostrara los campos globales.
                        } else {
                            if (hide_column == true) {
                                //Oculta los campos Column
                                library_hideview3.PxHideColumn(form, '', typeCreate);
                            }

                            if (hide_sublist == true) {
                                //Oculta los campos Cust Record
                                library_hideview3.PxHideSubTab(form, '', typeCreate);
                            }

                            if (hide_transaction == true) {
                                //Oculta los campos Body
                                library_hideview3.PxHide(form, '', typeCreate);
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
                    var LMRY_Result = ValidateAccess(subsidiary, form, recordObj);

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

                    // Solo if (type == 'view')
                    if (type == 'view') {
                        if (LMRY_Result[0] == 'PE') {
                            if (library.getAuthorization(1, licenses) == true) {
                                // Tipo de Transaccion
                                var Field = recordObj.getField({
                                    fieldId: 'custbody_lmry_transaction_type_doc'
                                });
                                if (Field != null && Field != '') {
                                    Field.isDisplay = true;
                                }

                                // Solo localizaciones Peruanas
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
                                    var Field = recordObj.getField({
                                        fieldId: 'custbody_lmry_transaction_type_doc'
                                    });
                                    if (Field != null && Field != '') {
                                        Field.isDisplay = true;
                                    }
                                }
                            }
                        }

                        // Logica GL Impact
                        var featurelang = runtime.isFeatureInEffect({
                            feature: 'LANGUAGE'
                        });
                        var btnGl = libraryGLImpact.featureGLImpact(recordObj, 'vendorcredit');
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
                    } // Fin if (type == 'view')

                    // Solo if (type == 'edit')
                    if (type == 'edit') {
                        var country = recordObj.getValue({
                            fieldId: 'custbody_lmry_subsidiary_country'
                        });
                        if (country == '') {
                            var Field = recordObj.getField({
                                fieldId: 'custbody_lmry_subsidiary_country'
                            });
                            if (Field != null && Field != '') {
                                Field.isDisabled = false;
                            }
                        }
                    } // Fin if (type == 'edit')

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

                    if (type == 'copy' || type == 'xcopy') {
                        Library_WHT_Transaction.cleanLinesforCopy(recordObj, licenses);
                    }

                    if (type == 'create') {
                        var createdFrom = recordObj.getValue({
                            fieldId: 'createdfrom'
                        });

                        //Si el bill credit es creado desde un Bill
                        if (createdFrom) {
                            Library_WHT_Transaction.cleanLinesforCopy(recordObj, licenses);
                        }
                    }

                    //SETEO DEL CUSTBODY LATAMREADY - BR TRANSACTION TYPE PARA FILTRAR LA COLUMNA CFOP
                    if (LMRY_Result[0] == 'BR' && LMRY_Result[2] == true && (type == 'create' || type == 'edit' || type == 'copy')) {
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

                                    recordObj.setValue({
                                        fieldId: 'custbody_lmry_br_transaction_type',
                                        value: resultTransactionType[0].getValue('internalid')
                                    });

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

                } // Fin if (type != 'print' && type != 'email')


            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2(' [ BeforeLoad ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }

        }


        function beforeSubmit(context) {

            try {
                recordObj = context.newRecord;
                type = context.type;
                var LMRY_Intern = recordObj.id;
                var form = context.form;

                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);

                var LMRY_Result = ValidateAccess(subsidiary, form, recordObj);

                //Nueva logica Country WHT Lineas
                libWHTLines.beforeSubmitTransaction(context, licenses);

                //Logica de Tipo de Cambio Automatico
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

                // Nueva logica de colombia
                switch (LMRY_Result[0]) {
                    case 'AR':
                        if (library.getAuthorization(200, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'BO':
                        if (library.getAuthorization(152, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                        /*case 'BR':
                          if (library.getAuthorization(147, licenses)) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                          }
                          break;*/
                    case 'CL':
                        if (library.getAuthorization(201, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'CO':
                        if (library.getAuthorization(150, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'CR':
                        if (library.getAuthorization(203, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                        // case 'EC':
                        //   if (library.getAuthorization(153, licenses) == true) {
                        //     Library_WHT_Transaction.beforeSubmitTransaction(context);
                        //   }
                        //   break;
                    case 'SV':
                        if (library.getAuthorization(205, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'GT':
                        if (library.getAuthorization(207, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'MX':
                        if (library.getAuthorization(209, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'PA':
                        if (library.getAuthorization(211, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'PY':
                        if (library.getAuthorization(213, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'PE':
                        if (library.getAuthorization(214, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                    case 'UY':
                        if (library.getAuthorization(216, licenses) == true) {
                            Library_WHT_Transaction.beforeSubmitTransaction(context);
                        }
                        break;
                }

                if (LMRY_Result[0] == "BR") {
                    if (["create", "edit", "copy"].indexOf(context.type) != -1) {
                        if (context.type == 'edit') {
                            cleanLinesforCopy(recordObj);
                        }
                    }
                }

                // SuiteTax Colombia
                if (LMRY_Result[0] == "CO") {
                    if (type == "delete") {
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            CO_ST_TaxLibrary.deleteTaxResult(LMRY_Intern);
                        }
                        if (library.getAuthorization(340, licenses) == true) {
                            CO_ST_WhtLibrary.deleteRelatedRecords(LMRY_Intern, "vendorcredit");
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

                //SETEO DE CAMPOS BASE 0%, 12% Y 14%
                var eventsEC = ['create', 'copy', 'edit'];
                if (LMRY_Result[0] == 'EC' && library.getAuthorization(42, licenses) && eventsEC.indexOf(context.type) != -1) {
                    libraryEcBaseAmounts.setBaseAmounts(recordObj, '1');
                }


            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2(' [ BeforeSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
        }


        function afterSubmit(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: "tax_overhauling"
                });

                recordObj = context.newRecord;
                type = context.type;

                var form = context.form;
                var LMRY_Intern = recordObj.id;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);
                var LMRY_Result = ValidateAccess(subsidiary, form, recordObj);

                if (type == 'delete') {
                    // Para Colombia, Bolivia y Paraguay - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'CO') {
                        if (library.getAuthorization(27, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorbill', LMRY_Intern);
                        }
                    }
                    if (LMRY_Result[0] == 'BO') {
                        if (library.getAuthorization(46, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorbill', LMRY_Intern);
                        }
                    }
                    if (LMRY_Result[0] == 'PY') {
                        if (library.getAuthorization(47, licenses)) {
                            // Elimina registros
                            library1.Delete_JE(LMRY_Intern);
                            // Delete Credit Memo
                            library1.Delete_CM('vendorbill', LMRY_Intern);
                        }
                    }
                }

                if (type == 'edit' && LMRY_Result[0] == 'BR' && library.getAuthorization(527, licenses)) {
                    record.submitFields({
                        type: 'vendorcredit',
                        id: LMRY_Intern,
                        values: {
                            'custbody_lmry_scheduled_process': false,
                        },
                        options: {
                            disableTriggers: true
                        }
                    });

                    Library_WHT_Transaction.deleteTaxResults(recordObj);
                }

                if (type == 'create' || type == 'edit' || type == 'copy') {
                    var transactionType = 'vendorcredit';
                    libWHTLines.afterSubmitTransaction(context, type, LMRY_Intern, transactionType, licenses);
                }

                if (type == 'create' || type == 'edit' || type == 'copy') {

                    // SuiteTax Colombia
                    if (LMRY_Result[0] == "CO") {
                        var recordCO = record.load({
                            type: "vendorcredit",
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
                        if (library.getAuthorization(340, licenses) == true) {
                            recordCO = context.newRecord;
                            CO_ST_WhtLibrary.setWHTTransaction(recordCO, context, licenses);
                        }
                    }

                    if (LMRY_Result[0] == "MX") {
                        var recordMX = record.load({
                            type: 'vendorcredit',
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

                }

                if (type == 'create' || type == 'edit') {
                    if (type == 'create') {
                        recordObj = record.load({
                            type: recordObj.type,
                            id: recordObj.id
                        });
                    }
                    if (LMRY_Result[0] == 'MX') {
                        if (library.getAuthorization(151, licenses) == true) {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                MX_ST_DIOT_Library.CalculoDIOT(recordObj);
                            } else {
                                libraryDIOT.CalculoDIOT(recordObj);
                            }
                        }
                    }
                    // Para Colombia, Bolivia y Paraguay - Enabled Feature WHT Latam
                    if (LMRY_Result[0] == 'CO') {
                        if (library.getAuthorization(27, licenses)) {
                            // Realiza la redireccion de cuentas
                            library1.Create_WHT_Latam('vendorcredit', LMRY_Intern);
                        }
                    }
                    if (LMRY_Result[0] == 'BO') {
                        if (library.getAuthorization(46, licenses)) {
                            // Realiza la redireccion de cuentas
                            library1.Create_WHT_Latam('vendorcredit', LMRY_Intern);
                        }
                    }
                    if (LMRY_Result[0] == 'PY') {
                        if (library.getAuthorization(47, licenses)) {
                            // Realiza la redireccion de cuentas
                            library1.Create_WHT_Latam('vendorcredit', LMRY_Intern);
                        }
                    }
                }

                // Nueva logica de colombia
                switch (LMRY_Result[0]) {
                    case 'AR':
                        if (library.getAuthorization(200, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'BO':
                        if (library.getAuthorization(152, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                        /*case 'BR':
                          if (library.getAuthorization(147, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                          }
                          break;*/
                    case 'CL':
                        if (library.getAuthorization(201, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'CO':
                        if (library.getAuthorization(150, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'CR':
                        if (library.getAuthorization(203, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                        // case 'EC':
                        //   if (library.getAuthorization(153, licenses) == true) {
                        //     Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        //   }
                        //   break;
                    case 'SV':
                        if (library.getAuthorization(205, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'GT':
                        if (library.getAuthorization(207, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'MX':
                        if (library.getAuthorization(209, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'PA':
                        if (library.getAuthorization(211, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'PY':
                        if (library.getAuthorization(213, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'PE':
                        if (library.getAuthorization(214, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                    case 'UY':
                        if (library.getAuthorization(216, licenses) == true) {
                            Library_WHT_Transaction.afterSubmitTransaction(context, true);
                        }
                        break;
                }

                //Logica Percepcion Opus
                var arreglo_item = new Array();
                var arreglo_amount = new Array();
                var arreglo_class = new Array();
                var arreglo_location = new Array();
                var arreglo_department = new Array();

                if (type == 'create' || type == 'edit') {
                    if (LMRY_Result[0] == 'AR' && library.getAuthorization(218, licenses)) {
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
                        }

                        var mirror_record = record.load({
                            type: recordObj.type,
                            id: recordObj.id,
                            isDynamic: false
                        });

                        var search_opus = search.create({
                            type: 'customrecord_lmry_percepcion_purchase',
                            columns: ['custrecord_lmry_percepcion_item1',
                                'custrecord_lmry_percepcion_item2', 'custrecord_lmry_percepcion_taxcode', 'custrecord_lmry_percepcion_subsidiary'
                            ],
                            filters: []
                        });

                        var result_opus = search_opus.run().getRange(0, 1000);

                        if (result_opus != null && result_opus.length > 0) {
                            for (var j = 0; j < arreglo_item.length; j++) {
                                for (var k = 0; k < result_opus.length; k++) {
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

                                        cantidad_items++;
                                    }
                                }

                            }
                        }

                        mirror_record.save();

                    }
                }


                if (type == 'create' || type == 'edit') {
                    /***********************************
                     * Solo si tiene el Feature activo
                     * AR - WHT Payment
                     ***********************************/
                    if (LMRY_Result[0] == 'AR') {
                        if (library.getAuthorization(138, licenses)) {
                            GroupLine(context, LMRY_Intern);
                        }
                    } // Solo AR - SUM TAX CODE GROUP
                }

            } catch (err) {
                recordObj = context.newRecord;
                library.sendemail2(' [ VCUret_AfterSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }
        }

        /* ------------------------------------------------------------------------------------------------------
         * A la variable featureId se le asigna el valore que le corresponde
         * --------------------------------------------------------------------------------------------------- */
        function ValidateAccess(ID, form, recordObj) {
            var LMRY_access = false;
            var LMRY_countr = new Array();
            var LMRY_Result = new Array();
            //Nombre de la transaccion
            var typeAccess = recordObj.type;

            try {

                // Inicializa variables Locales y Globales
                var featureId = '0';
                LMRY_countr = library.Validate_Country(ID);

                // Verifica que el arreglo este lleno
                if (LMRY_countr.length < 1) {
                    LMRY_Result[0] = '';
                    LMRY_Result[1] = '-None-';
                    LMRY_Result[2] = LMRY_access;
                    return LMRY_Result;
                }

                LMRY_access = library.getCountryOfAccess(LMRY_countr, licenses);

                // Asigna Valores
                LMRY_Result[0] = LMRY_countr[0];
                LMRY_Result[1] = LMRY_countr[1];
                LMRY_Result[2] = LMRY_access;
            } catch (err) {
                library.sendemail2(' [ ValidateAccess ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
            }

            return LMRY_Result;
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
                        arr_DatCol["TaxAmoun"] = 0; // Amount
                        arr_DatCol["TaxBase"] = ''; // Latam - Setup Amount To

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

        function cleanLinesforCopy(RCD_TRANS) {
            try {
                var numLineas = RCD_TRANS.getLineCount({
                    sublistId: 'item'
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
                            RCD_TRANS.setSublistValue('item', 'tax1amt', i, 0);
                            RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');
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