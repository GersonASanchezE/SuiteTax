/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ExpenseReportURET_V2.0.js                   ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 11 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/runtime', 'N/search', 'N/log', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_CusTransferIvaLBRY_V2.0',
        './Latam_Library/LMRY_libDIOTLBRY_V2.0', './Latam_Library/LMRY_HideViewLBRY_V2.0', './WTH_Library/LMRY_TransferIva_LBRY',
        './Latam_Library/LMRY_MX_ST_ExpenseReport_Tax_Transaction_LBRY_V2.0', './Latam_Library/LMRY_MX_ST_DIOT_LBRY_V2.0'
    ],

    function(record, runtime, search, log, library, library1, libraryDIOT, Library_HideView, LibraryTransferIva, MX_ST_TaxLibrary, ST_Library_DIOT) {

        var LMRY_script = 'LatamReady - Expense Report URET V2.0';
        var isURET = true;
        var type = '';
        var recordObj = null;
        var LMRY_Result;
        var licenses = [];
        var ST_FEATURE = false;
        /**
         * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
         * @appliedtorecord recordType
         *
         * @param {String} type Operation types: create, edit, view, copy, print, email
         * @param {nlobjForm} form Current form
         * @param {nlobjRequest} request Request object
         * @returns {Void}
         */
        function beforeLoad(context) {
            try {
                recordObj = context.newRecord;
                type = context.type;
                var country = new Array();
                country[0] = '';
                country[1] = '';
                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);
                if (licenses == null || licenses == '') {
                    licenses = [];
                }

                if (context.type == 'create') {
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
                        Library_HideView.HideSubTab(form, country[1], recordObj.type, licenses);
                        //Library_HideView.HideColumn(form, country[1], recordObj.type);
                    }

                }

                if (type != 'print' && type != 'email') {
                    //Muestra campos LMRY por Pais
                    var LMRY_countr = ValidateAccess(subsidiary, form);

                    if (LMRY_countr[2] == true) {

                        // Tipo de Documento - Parent
                        var lmry_TipRpt = recordObj.getValue({
                            fieldId: 'custbody_lmry_type_report'
                        });
                        if (lmry_TipRpt != '' && lmry_TipRpt != null) {
                            // Solo para Credit Memo
                            library.onFieldsDisplayBody(form, LMRY_countr[1], 'custrecord_lmry_on_expense_report', isURET);

                            // Visualiza campos LMRY
                            library.onFieldsDisplayParent2(form, LMRY_countr[1], lmry_TipRpt, isURET);
                        }
                    }
                }
            } catch (err) {
                library.sendemail(' [ beforeLoad ] ' + err, LMRY_script);
            }
        }
        /**
         * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
         * @appliedtorecord recordType
         *
         * @param {String} type Operation types: create, edit, delete, xedit
         *                      approve, reject, cancel (SO, ER, Time Bill, PO & RMA only)
         *                      pack, ship (IF)
         *                      markcomplete (Call, Task)
         *                      reassign (Case)
         *                      editforecast (Opp, Estimate)
         * @returns {Void}
         */
        function beforeSubmit(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

                recordObj = context.newRecord;
                type = context.type;
                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });
                LMRY_Result = ValidateAccess(subsidiary, form);
                licenses = library.getLicenses(subsidiary);

                if (type == 'delete') {
                    LMRY_Result = ValidateAccess(subsidiary, form);

                    // Solo para Mexico
                    if (LMRY_Result[0] == 'MX') {
                        if (library.getAuthorization(21, licenses) == true) {
                            // Elimina registros
                            library1.ERDeleteJE(recordObj.id);
                        }
                    }
                }

                // SuiteTax Mexico
                if (LMRY_Result[0] == "MX") {
                    if (type == "delete") {
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            MX_ST_TaxLibrary.deleteTaxResult(recordObj.id);
                        }
                    }
                }

            } catch (err) {
                library.sendemail(' [ beforeSubmit ] ' + err, LMRY_script);
            }
        }
        /**
         * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
         * @appliedtorecord recordType
         *
         * @param {String} type Operation types: create, edit, delete, xedit,
         *                      approve, cancel, reject (SO, ER, Time Bill, PO & RMA only)
         *                      pack, ship (IF only)
         *                      dropship, specialorder, orderitems (PO only)
         *                      paybills (vendor payments)
         * @returns {Void}
         */
        function afterSubmit(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

                recordObj = context.newRecord;
                type = context.type;
                var form = context.form;
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });

                licenses = library.getLicenses(subsidiary);

                if (type != 'print' && type != 'email') {
                    LMRY_Result = ValidateAccess(subsidiary, form);
                }

                // Solo si la transaccion es Creada, Editada y/o Copiada
                if (type == 'create' || type == 'edit' || type == 'copy') {

                    if (LMRY_Result[0] == 'MX' && library.getAuthorization(243, licenses) == true) {
                        LibraryTransferIva.generateMXTransField(context);
                    }

                    // SuiteTax Mexico
                    if (LMRY_Result[0] == "MX") {
                        var recordMX = record.load({
                            type: 'expensereport',
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
                            id: recordObj.id,
                            isDynamic: false
                        });
                    }

                    // Solo para Mexico
                    if (LMRY_Result[0] == 'MX') {
                        if (library.getAuthorization(151, licenses) == true) {
                            if (ST_FEATURE == true || ST_FEATURE == "T") {
                                ST_Library_DIOT.CalculoDIOT(recordObj);
                            } else {
                                libraryDIOT.CalculoDIOT(recordObj);
                            }
                        }
                        if (library.getAuthorization(21, licenses) == true) {
                            // Elimina registros
                            library1.ERDeleteJE(recordObj.id);

                            // Realiza el traslado de IVA del ER
                            library1.ERTransferIVA(recordObj.id);
                        }
                    }

                    if (LMRY_Result[0] == 'AR' || LMRY_Result[0] == 'MX' || LMRY_Result[0] == 'PE') {
                        if (library.getAuthorization(100, licenses) == true || library.getAuthorization(20, licenses) == true || library.getAuthorization(136, licenses) == true) {
                            var internalID = recordObj.id;
                            var expReportAux = record.load({
                                type: 'expensereport',
                                id: internalID
                            });
                            var lineasAux = expReportAux.getLineCount({
                                sublistId: 'expense'
                            });
                            for (var cuentaLineas = 0; cuentaLineas < lineasAux; cuentaLineas++) {
                                var tipoCambioAux = expReportAux.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'exchangerate',
                                    line: cuentaLineas
                                });
                                //if(expReportAux.getFieldValue('usemulticurrency')=='T'){
                                expReportAux.setSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_tipo_cambio_inf_gastos',
                                    line: cuentaLineas,
                                    value: tipoCambioAux
                                });
                                //}else{
                                //	expReportAux.setLineItemValue('expense', 'custcol_lmry_tipo_cambio_inf_gastos', cuentaLineas, 1);
                                //}
                            }
                            var recordID = expReportAux.save();
                        }
                    }
                }
            } catch (err) {
                library.sendemail(' [ afterSubmit ] ' + err, LMRY_script);
            }
        }
        /* ------------------------------------------------------------------------------------------------------
         * A la variable featureId se le asigna el valore que le corresponde
         * --------------------------------------------------------------------------------------------------- */
        function ValidateAccess(ID, form) {
            var LMRY_access = false;
            var LMRY_countr = new Array();
            var LMRY_Result = new Array();
            try {
                // Oculta todos los campos LMRY
                if (type == 'view') {
                    library.onFieldsHide([2], form, isURET);
                }
                // Inicializa variables Locales y Globales
                var featureId = '0';
                LMRY_countr = library.Validate_Country(ID);
                // Verifica que el arreglo este lleno
                if (LMRY_countr.length < 1) {
                    return true;
                }

                if ((type == 'view' || type == 'edit') && (form != '' && form != null)) {
                    //Library_HideView.HideColumn(form, LMRY_countr[1], recordObj.type);
                    Library_HideView.HideSubTab(form, LMRY_countr[1], recordObj.type, licenses);
                }

                LMRY_access = library.getCountryOfAccess(LMRY_countr, licenses);
                // Solo si tiene acceso
                if (LMRY_access == true) {
                    if (type == 'view') {
                        library.onFieldsDisplayBody(form, LMRY_countr[1], 'custrecord_lmry_on_expense_report', isURET);
                    }
                }

                // Asigna Valores
                LMRY_Result[0] = LMRY_countr[0]; //MX
                LMRY_Result[1] = LMRY_countr[1]; //Mexico
                LMRY_Result[2] = LMRY_access;
            } catch (err) {
                library.sendemail(' [ ValidateAccessVB ] ' + err, LMRY_script);
            }

            return LMRY_Result;
        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });