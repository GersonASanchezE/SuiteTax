/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHT_ON_PAYMENTS_STLT.js  				            ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Set 22 2017  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record', 'N/currency', 'N/log', 'N/xml', 'N/ui/serverWidget', 'N/search', 'N/runtime', 'N/redirect', 'N/email', 'N/format',
  './WTH_Library/LMRY_WHT_ON_Payments_LBRY', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', "./Latam_Library/LMRY_Log_LBRY_V2.0"],

  function (record, currency, log, xml, serverWidget, search, runtime, redirect, email, format, library, librarySend, lbryLog) {
    // Nombre del Script
    var LMRY_script = "LatamReady - WHT ON PAYMENTS STLT";
    var Language = runtime.getCurrentScript().getParameter({ name: 'LANGUAGE' });
    Language = Language.substring(0, 2);

    //Traducción de campos
    switch (Language) {
      case 'es':
        // Nombres de campos
        var LblMsg1 = 'AVISO: Actualmente la licencia para este módulo está vencida, por favor contacte al equipo comercial de LatamReady';
        var LblMsg2 = 'También puedes contactar con nosotros a través de';
        var LblMsg3 = 'Importante: El acceso no está permitido';
        var LblGroup1 = 'Información Primaria';
        var LblTittleMsg = 'Mensaje';
        var LblMulti = 'Multibooking';
        var LblName = 'Nombre';
        var LblBook = 'Libro';
        var LblSub = 'Subsidiaria';
        var LblBaseCur = 'Moneda Base';
        var LblCur = 'Moneda';
        var LblAPAccount = 'Cuenta A/P';
        var LblBnkAccount = 'Cuenta Bancaria';
        var LblActPrd = 'Periodo Contable';
        var LblGroup2 = 'Clasificación';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Método de pago';
        var LblClass = 'Clase';
        var LblLct = 'Ubicación';
        var LblIDProcess = 'IDProceso';
        var TabTrans = 'Transacciones';
        var LblTrans = 'Transacción';
        var LblApply = 'Aplicar';
        var LblInternalID = 'ID Interno';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Monto Total';
        var LblDueAm = 'Monto Adeudado';
        var LblPay = 'Pago';
        var LblFiscalDoc = 'Documento Fiscal';
        var LblPayee = 'Beneficiario';
        var LblBillCred = 'Bill Credit';
        var LblElecPay = 'Pago electrónico EFT';
        var LblDate = 'Fecha';
        var BtnBack = 'Atrás';
        var BtnSave = 'Guardar';
        var BtnFiltrar = 'Filtrar';
        var BtnReset = 'Reset';
        var LblForm = 'LatamTAX - Pagos de Bills';
        var LblExRate = 'Tipo de Cambio';
        var BtnMarkAll = 'Marcar Todo';
        var BtnDesmarkAll = 'Desmarcar Todo';
        break;

      case 'pt':
        // Nombres de campos
        var LblMsg1 = 'AVISO: Atualmente a licença para este módulo expirou, entre em contato com a equipe comercial da LatamReady';
        var LblMsg2 = 'Você também pode nos contatar através de';
        var LblMsg3 = 'Importante: o acesso não é permitido';
        var LblGroup1 = 'Informação Primária';
        var LblTittleMsg = 'Mensagem';
        var LblMulti = 'Multibooking';
        var LblName = 'Nome';
        var LblBook = 'Livro';
        var LblSub = 'Subsidiária';
        var LblBaseCur = 'Moeda Base';
        var LblCur = 'Moeda';
        var LblAPAccount = 'Conta A / P';
        var LblBnkAccount = 'Conta bancária';
        var LblActPrd = 'Período contábil';
        var LblGroup2 = 'Classificação';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Forma de Pagamento';
        var LblClass = 'Classe';
        var LblLct = 'Localização';
        var LblIDProcess = 'ID do processo';
        var TabTrans = 'Transações';
        var LblTrans = 'Transação';
        var LblApply = 'Aplicar';
        var LblInternalID = 'ID Interno';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Montante total';
        var LblDueAm = 'Quantia Devida';
        var LblPay = 'Pagamento';
        var LblFiscalDoc = 'Documento Fiscal';
        var LblPayee = 'Beneficiário';
        var LblBillCred = 'Bill Credit';
        var LblElecPay = 'Pagamento Eletrônico EFT';
        var LblDate = 'Data';
        var BtnBack = 'Voltar';
        var BtnSave = 'Salve';
        var BtnFiltrar = 'Filtro';
        var BtnReset = 'Redefinir';
        var LblForm = 'LatamTAX - Pagamentos de Bill';
        var LblExRate = 'Taxa de câmbio';
        var BtnMarkAll = 'Marcar Tudo';
        var BtnDesmarkAll = 'Desmarcar Tudo';
        break;

      default:
        // Nombres de campos
        var LblMsg1 = 'NOTICE: Currently the license for this module is expired, please contact the commercial team of LatamReady';
        var LblMsg2 = 'You can also contact us through';
        var LblMsg3 = 'Important: Access is not allowed';
        var LblGroup1 = 'Primary Information';
        var LblTittleMsg = 'Message';
        var LblMulti = 'Multibooking';
        var LblName = 'Name';
        var LblBook = 'Book';
        var LblSub = 'Subsidiary';
        var LblBaseCur = 'Base currency';
        var LblCur = 'Currency';
        var LblAPAccount = 'A/P Account';
        var LblBnkAccount = 'Bank Account';
        var LblActPrd = 'Accounting Period';
        var LblGroup2 = 'Classification';
        var LblDpt = 'Department';
        var LblPyMtd = 'LATAM - Payment Method';
        var LblClass = 'Class';
        var LblLct = 'Location';
        var LblIDProcess = 'Process ID';
        var TabTrans = 'Transactions';
        var LblTrans = 'Transaction';
        var LblApply = 'Apply';
        var LblInternalID = 'Internal ID';
        var LblSublist = 'Sublist'
        var LblTotalAm = 'Total amount';
        var LblDueAm = 'Amount due';
        var LblPay = 'Payment';
        var LblFiscalDoc = 'Fiscal Document';
        var LblPayee = 'Payee';
        var LblBillCred = 'Bill Credit';
        var LblElecPay = 'Electronic Payment EFT';
        var LblDate = 'Date';
        var BtnBack = 'Back';
        var BtnSave = 'Save';
        var BtnFiltrar = 'Filter';
        var BtnReset = 'Reset';
        var LblForm = 'LatamTAX - Bill Payments';
        var LblExRate = 'Exchange Rate';
        var BtnMarkAll = 'Mark all';
        var BtnDesmarkAll = 'Desmark all';
    }

    function onRequest(context) {
      try {
        if (context.request.method == 'GET') {

          // 138 Argentina , 139 = Paraguay y 141 = Brasil

          var allLicenses = librarySend.getAllLicenses();

          var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

          // Parametros del Redirect
          var multicurrency = runtime.isFeatureInEffect({ feature: "MULTICURRENCY" });

          var Rd_SubId = context.request.parameters.custparam_subsi;
          var Rd_PayId = context.request.parameters.custparam_payee;
          var Rd_CurId = context.request.parameters.custparam_curre;
          var Rd_AccId = context.request.parameters.custparam_accon;
          var Rd_DateId = context.request.parameters.custparam_date;
          var Rd_BacId = context.request.parameters.custparam_bacco;
          var Rd_PerId = context.request.parameters.custparam_acper;
          var Rd_RatId = context.request.parameters.custparam_exrat;
          var Rd_DepId = context.request.parameters.custparam_depar;
          var Rd_ClaId = context.request.parameters.custparam_class;
          var Rd_LocId = context.request.parameters.custparam_locat;
          var Rd_MetId = context.request.parameters.custparam_metho;

          var form = serverWidget.createForm({ title: LblForm });
          form.addFieldGroup({ id: 'group_pi', label: LblGroup1 });

          //Subsidiary --one world
          if (subsi_OW == true) {

            var p_subsi = form.addField({
              id: 'custpage_id_subsi',
              label: LblSub,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });

            var Filter_Custo = new Array();
            Filter_Custo[0] = search.createFilter({ name: 'isinactive', operator: search.Operator.IS, values: 'F' });
            Filter_Custo[1] = search.createFilter({ name: 'country', operator: search.Operator.ANYOF, values: 'AR' });

            var search_Subs = search.create({ type: search.Type.SUBSIDIARY, filters: Filter_Custo, columns: ['internalid', 'name'] });
            var resul_sub = search_Subs.run();
            var lengt_sub = resul_sub.getRange({ start: 0, end: 1000 });
            var contador = 0;

            if (lengt_sub != null && lengt_sub.length > 0) {
              // Llena una linea vacia
              p_subsi.addSelectOption({ value: 0, text: ' ' });
              // Llenado de listbox
              for (var i = 0; i < lengt_sub.length; i++) {
                var subID = lengt_sub[i].getValue('internalid');
                var subNM = lengt_sub[i].getValue('name');

                if (allLicenses[subID] != null && allLicenses[subID] != undefined) {
                  for (var j = 0; j < allLicenses[subID].length; j++) {
                    if (allLicenses[subID][j] == 138) {
                      p_subsi.addSelectOption({ value: subID, text: subNM });
                      contador++;
                    }
                  }
                }

              }
            }

            p_subsi.isMandatory = true;

            if (contador == 0) {
              var form = serverWidget.createForm({ title: LblForm });

              // Mensaje para el cliente
              var myInlineHtml = form.addField({ id: 'custpage_lmry_v_message', label: LblTittleMsg, type: serverWidget.FieldType.INLINEHTML });

              myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
              myInlineHtml.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

              var strhtml = "<html>";
              strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                "<tr>" +
                "</tr>" +
                "<tr>" +
                "<td class='text'>" +
                "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                LblMsg1 + ".</br>" + LblMsg2 + "www.Latamready.com" +
                "</div>" +
                "</td>" +
                "</tr>" +
                "</table>" +
                "</html>";
              myInlineHtml.defaultValue = strhtml;

              // Dibuja el formularios
              context.response.writePage(form);

              // Termina el SuiteLet
              return true;
            }

            // Seteo en el rellamado
            if (Rd_SubId != '' && Rd_SubId != null) {
              p_subsi.defaultValue = Rd_SubId;
            }

            var p_accountpay = form.addField({
              id: 'custpage_id_account_pay',
              label: LblAPAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_accountpay.isMandatory = true;

          } else {
            var p_accountpay = form.addField({
              id: 'custpage_id_account_pay',
              label: LblAPAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_accountpay.isMandatory = true;

            var search_pay = search.load({ id: 'customsearch_lmry_wht_account_payable' });
            search_pay.filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));

            var resul_pay = search_pay.run();
            var lengt_pay = resul_pay.getRange({ start: 0, end: 1000 });

            if (lengt_pay != null && lengt_pay.length > 0) {
              var columns_app = lengt_pay[0].columns;
              p_accountpay.addSelectOption({ value: 0, text: ' ' });
              for (var i = 0; i < lengt_pay.length; i++) {
                var payID = lengt_pay[i].getValue(columns_app[0]);
                var payNM = lengt_pay[i].getValue(columns_app[1]);

                if (payNM != null && payNM != '') {
                  p_accountpay.addSelectOption({ value: payID, text: payNM });
                }

              }
            }

          }

          var p_curren = form.addField({
            id: 'custpage_id_curren',
            label: LblCur,
            type: serverWidget.FieldType.SELECT,
            container: 'group_pi'
          });
          p_curren.isMandatory = true;

          // Seteo en el rellamado
          if (Rd_CurId != '' && Rd_CurId != null) {
            p_curren.defaultValue = Rd_CurId;
          }

          if (subsi_OW == true) {
            var p_bank = form.addField({
              id: 'custpage_id_bank',
              label: LblBnkAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_bank.isMandatory = true;

            if (Rd_BacId != '' && Rd_BacId != null) {
              p_bank.defaultValue = Rd_BacId;
            }
          } else {
            var p_bank = form.addField({
              id: 'custpage_id_bank',
              label: LblBnkAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_bank.isMandatory = true;

            var search_bank = search.load({ id: 'customsearch_lmry_wht_bank_account' });
            search_bank.filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));

            var resul_bank = search_bank.run();
            var lengt_bank = resul_bank.getRange({ start: 0, end: 1000 });

            if (lengt_bank != null && lengt_bank.length > 0) {
              p_bank.addSelectOption({ value: 0, text: ' ' });
              var columns_bank = lengt_bank[0].columns;
              for (var i = 0; i < lengt_bank.length; i++) {
                var bankID = lengt_bank[i].getValue(columns_bank[0]);
                var bankNM = lengt_bank[i].getValue(columns_bank[1]);
                if (bankNM != null && bankNM != '') {
                  p_bank.addSelectOption({ value: bankID, text: bankNM });
                }
              }
            }
            if (Rd_BacId != '' && Rd_BacId != null) {
              p_bank.defaultValue = Rd_BacId;
            }
          }


          var p_date = form.addField({
            id: 'custpage_id_date',
            label: LblDate,
            type: serverWidget.FieldType.DATE,
            source: 'date',
            container: 'group_pi'
          });

          if (Rd_DateId != null && Rd_DateId != '') {
            p_date.defaultValue = Rd_DateId;
            p_date.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
          }

          var p_period = form.addField({
            id: 'custpage_id_period',
            label: LblActPrd,
            type: serverWidget.FieldType.SELECT,
            container: 'group_pi'
          });
          p_period.isMandatory = true;

          // Seteo en el rellamado
          if (Rd_PerId != '' && Rd_PerId != null) {
            p_period.defaultValue = Rd_PerId;
          }

          var p_exrate = form.addField({
            id: 'custpage_id_rate',
            label: LblExRate,
            type: serverWidget.FieldType.FLOAT,
            source: 'exchangerate',
            container: 'group_pi'
          });
          p_exrate.isMandatory = true;

          // Seteo en el rellamado
          if (Rd_RatId != '' && Rd_RatId != null) {
            p_exrate.defaultValue = Rd_RatId;
          }

          if (subsi_OW) {
            var p_payee = form.addField({
              id: 'custpage_id_payee',
              label: LblPayee,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_payee.isMandatory = true;
          } else {
            var p_payee = form.addField({
              id: 'custpage_id_payee',
              label: LblPayee,
              source: 'vendor',
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_payee.isMandatory = true;
          }

          // Seteo en el rellamado
          if (Rd_PayId != '' && Rd_PayId != null) {
            p_payee.defaultValue = Rd_PayId;
          }

          var p_check = form.addField({
            id: 'custpage_id_check',
            label: 'CHECK #',
            type: serverWidget.FieldType.TEXT,
            container: 'group_pi'
          });

          var setupTaxSubsiary = null;

          if (Number(Rd_SubId)) {
            var filtros = [];
            filtros.push(["isinactive", "is", "F"]);
            if (subsi_OW) {
              filtros.push("AND", ["custrecord_lmry_setuptax_subsidiary", "anyof", Rd_SubId]);
            }
            var search_setup = search.create({
              type: 'customrecord_lmry_setup_tax_subsidiary', filters: filtros,
              columns: ['custrecord_lmry_setuptax_check', 'custrecord_lmry_setuptax_prefix', 'custrecord_lmry_setuptax_minimum_digits',
                'custrecord_lmry_setuptax_current_number', 'custrecord_lmry_setuptax_elec_payment', 'custrecord_lmry_setuptax_currency']
            });
            var result_search_setup = search_setup.run().getRange({ start: 0, end: 1 });
            if (result_search_setup && result_search_setup.length) {
              setupTaxSubsiary = {
                mandatory_check: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_check' }),
                prefix: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_prefix' }),
                minimumDigits: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_minimum_digits' }),
                currentNumber: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_current_number' }),
                campo_eft: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_elec_payment' }),
                currency_setup: result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_currency' })
              }
            }
          }

          log.debug("setupTaxSubsidiary", setupTaxSubsiary);

          //VALIDACION CAMPO CHECK SEA MANDATORY(ASTERISCO) CON EL RECORD SETUP TAX
          if (Rd_PayId == '' || Rd_PayId == null) {
            p_check.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
          } else {
            if (setupTaxSubsiary) {
              var mandatory_check = setupTaxSubsiary.mandatory_check;
              if (mandatory_check) {
                p_check.isMandatory = true;
              }

              var prefix = setupTaxSubsiary.prefix
              var minimumDigits = setupTaxSubsiary.minimumDigits
              var currentNumber = setupTaxSubsiary.currentNumber;

              var checkNumber = '';

              if (parseFloat(currentNumber) >= 0) {
                currentNumber++;
                if (prefix) { checkNumber = prefix; }
                if (parseFloat(minimumDigits) >= 0) {
                  if (minimumDigits > (currentNumber + "").length) {
                    for (var i = 0; i < minimumDigits - (currentNumber + "").length; i++) {
                      checkNumber += '0';
                    }

                  }
                }
                checkNumber += currentNumber;
                p_check.defaultValue = checkNumber;
              }
            }
          }

          form.addField({
            id: 'custpage_data_log',
            label: 'Data Log',
            type: serverWidget.FieldType.LONGTEXT
          }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

          var p_memo = form.addField({
            id: 'id_memo',
            label: 'MEMO',
            type: serverWidget.FieldType.TEXT,
            container: 'group_pi'
          });
          if (Rd_PayId == '' || Rd_PayId == null) {
            p_memo.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
          }
          if (Rd_PayId != '' && Rd_PayId != null) {
            var p_stado = form.addField({
              id: 'id_state',
              label: LblIDProcess,
              type: serverWidget.FieldType.TEXT,
              container: 'group_pi'
            });
            p_stado.defaultValue = 'PENDIENTE';
            p_stado.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
          }

          if (Rd_PayId != '' && Rd_PayId != null) {
            /***************************************
             * Valida si esta instalado el bundle
             * 244403	Electronic Bank Payments
             ***************************************/
            var search_bundle = search.create({
              type: search.Type.SAVED_SEARCH,
              filters: [{
                name: "formulatext",
                formula: "{bundle.name}",
                operator: search.Operator.CONTAINS,
                values: ["Electronic Bank Payments"]
              }], columns: ["internalid"]
            });
            var result_bundle = search_bundle.run().getRange({ start: 0, end: 1000 });
            if (setupTaxSubsiary) {
              var campo_eft = setupTaxSubsiary.campo_eft;
              if (campo_eft && result_bundle.length > 0) {
                var p_eft = form.addField({ id: 'custpage_id_eft', label: LblElecPay, type: serverWidget.FieldType.CHECKBOX, container: 'group_pi' });
              }
            }
          }

          form.addFieldGroup({ id: 'group_cla', label: LblGroup2 });

          //Activacion de enable features
          var enab_dep = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });

          var enab_loc = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

          var enab_clas = runtime.isFeatureInEffect({ feature: "CLASSES" });

          //activacion de Accounting Preferences
          var userObj = runtime.getCurrentUser();
          var pref_dep = userObj.getPreference({ name: "DEPTMANDATORY" });

          var pref_loc = userObj.getPreference({ name: "LOCMANDATORY" });

          var pref_clas = userObj.getPreference({ name: "CLASSMANDATORY" });

          // Solo para One World
          if (subsi_OW == true) {
            if (enab_dep == true) {
              var c_depart = form.addField({
                id: 'custpage_id_depart',
                label: LblDpt,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_dep == true) {
                c_depart.isMandatory = true;
              }
            }
            var c_payMeth = form.addField({
              id: 'custpage_id_method',
              label: LblPyMtd,
              type: serverWidget.FieldType.SELECT,
              container: 'group_cla'
            });
            c_payMeth.isMandatory = true;

            if (enab_loc == true) {
              var c_location = form.addField({
                id: 'custpage_id_location',
                label: LblLct,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_loc == true) {
                c_location.isMandatory = true;
              }
            }
            if (enab_clas == true) {
              var c_class = form.addField({
                id: 'custpage_id_class',
                label: LblClass,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_clas == true) {
                c_class.isMandatory = true;
              }
            }

            //  Cargas la ubicacion
            if (Rd_SubId != '' && Rd_SubId != null) {
              // Internal ID de la subsidiaria
              if (enab_clas == true) {
                c_class.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }
              if (enab_loc == true) {
                c_location.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }
              if (enab_dep == true) {
                c_depart.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }

              //c_class.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
              p_subsi.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

              p_date.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

              p_period.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

              p_exrate.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

              var subs = Rd_SubId;

              //Recargado de Select Payee
              if (Number(Rd_PayId)) {
                var field_payee = p_payee;

                var searchVendor = search.lookupFields({
                  type: "vendor",
                  id: Rd_PayId,
                  columns: ['internalid', 'entityid', 'isperson', 'lastname', 'firstname', 'companyname', 'middlename']
                });

                if (searchVendor) {
                  var vendorName = "";
                  if (searchVendor.isperson == true || searchVendor.isperson == "T") {
                    vendorName = searchVendor.firstname || ""
                    vendorName = vendorName + " ";
                    var middleName = searchVendor.middlename;
                    if (middleName) {
                      vendorName = vendorName + middleName.substring(0, 1) + " ";
                    }
                    var lastName = searchVendor.lastname || "";
                    vendorName = vendorName + lastName;
                  } else {
                    if (searchVendor.companyname) {
                      vendorName = searchVendor.companyname;
                    } else {
                      vendorName = searchVendor.entityid;
                    }
                    field_payee.addSelectOption({ value: Rd_PayId, text: vendorName });
                  }
                  field_payee.defaultValue = Rd_PayId;
                  field_payee.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }
              }

              //Recargado de campo A/P Account
              if (Number(Rd_AccId)) {
                var field_acc_payable = p_accountpay;
                var accPayName = search.lookupFields({
                  type: "account",
                  id: Rd_AccId,
                  columns: ["name"]
                }).name;

                field_acc_payable.addSelectOption({ value: Rd_AccId, text: accPayName });
              }


              //Recargado de campo Bank ACCOUNT
              if (Number(Rd_BacId)) {
                var field_bank = p_bank;

                var BankAccName = search.lookupFields({
                  type: "account",
                  id: Rd_BacId,
                  columns: ["name"]
                }).name;

                field_bank.addSelectOption({ value: Rd_BacId, text: BankAccName });
                field_bank.defaultValue = Rd_BacId;
                field_bank.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }

              //Reseteo campo accounting period
              if (Number(Rd_PerId)) {
                var field_accounting_period = p_period;
                var periodName = search.lookupFields({
                  type: "accountingperiod",
                  id: Rd_PerId,
                  columns: ["periodname"]
                }).periodname;

                field_accounting_period.addSelectOption({ value: Rd_PerId, text: periodName });

                field_accounting_period.defaultValue = Rd_PerId;
                field_accounting_period.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }

              //Reseteo campo currency
              if (Number(Rd_CurId)) {
                var field_currency = p_curren;

                var currencyName = search.lookupFields({
                  type: "currency",
                  id: Rd_CurId,
                  columns: ["name"]
                }).name;
                field_currency.addSelectOption({ value: Rd_CurId, text: currencyName });
                field_currency.defaultValue = Rd_CurId;
                field_currency.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }

              // Carga el departamento filtrado por subsidiaria
              if (enab_dep == true) {
                // Seteo en el rellamado
                if (Number(Rd_DepId)) {
                  var field_depart = c_depart;
                  var departmentName = search.lookupFields({
                    type: "department",
                    id: Rd_DepId,
                    columns: ["name"]
                  }).name;

                  field_depart.addSelectOption({
                    value: Rd_DepId,
                    text: departmentName
                  });

                  field_depart.defaultValue = Rd_DepId;
                  field_depart.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }
              }

              // Carga el Class filtrado por subsidiaria
              if (enab_clas == true) {
                if (Number(Rd_ClaId)) {
                  var field_clas = c_class;
                  var className = search.lookupFields({
                    type: "classification",
                    id: Rd_ClaId,
                    columns: ["name"]
                  }).name;

                  field_clas.addSelectOption({
                    value: Rd_ClaId,
                    text: className
                  });

                  field_clas.defaultValue = Rd_ClaId;
                  field_clas.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }
              }

              if (enab_loc == true) {
                // Carga el location filtrado por subsidiaria
                if (Number(Rd_LocId)) {
                  var field_loc = c_location;
                  var locationName = search.lookupFields({
                    type: "location",
                    id: Rd_LocId,
                    columns: ["name"]
                  }).name;

                  field_loc.addSelectOption({
                    value: Rd_LocId,
                    text: locationName
                  });

                  field_loc.defaultValue = Rd_LocId;
                  field_loc.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }
              }
              // Carga el LATAM - PAYMENT METHOD filtrado por subsidiaria
              if (Number(Rd_MetId)) {
                var field_met = c_payMeth;
                var methodName = search.lookupFields({
                  type: "customrecord_lmry_paymentmethod",
                  id: Rd_MetId,
                  columns: ["name"]
                }).name;

                field_met.addSelectOption({
                  value: Rd_MetId,
                  text: methodName
                });
                field_met.defaultValue = Rd_MetId;
                field_met.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
              }
            } // Fin if Rd_Sub, y el de abajo si es One_World
          } else {
            //Mismarket Edition
            if (enab_dep == true) {
              var c_depart = form.addField({
                id: 'custpage_id_depart',
                label: LblDpt,
                type: serverWidget.FieldType.SELECT,
                source: 'department',
                container: 'group_cla'
              });
              c_depart.isMandatory = true;
            }

            var c_payMeth = form.addField({
              id: 'custpage_id_method',
              label: LblPyMtd,
              type: serverWidget.FieldType.SELECT,
              source: 'custbody_lmry_paymentmethod',
              container: 'group_cla'
            });
            c_payMeth.isMandatory = true;

            if (enab_loc == true) {
              var c_location = form.addField({
                id: 'custpage_id_location',
                label: LblLct,
                type: serverWidget.FieldType.SELECT,
                source: 'location',
                container: 'group_cla'
              });
              c_location.isMandatory = true;
            }

            if (enab_clas == true) {
              var c_class = form.addField({
                id: 'custpage_id_class',
                label: LblClass,
                type: serverWidget.FieldType.SELECT,
                source: 'class',
                container: 'group_cla'
              });
              c_class.isMandatory = true;
            }

            if (Rd_PayId != null && Rd_PayId != '') {
              var field_payee = p_payee;
              field_payee.defaultValue = Rd_PayId;
              field_payee.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }

            if (Rd_CurId != null && Rd_CurId != '') {
              var field_currency = p_curren;
              field_currency.defaultValue = Rd_CurId;
              field_currency.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }

            //field_accounting_period.addSelectOption({value:0,text:' '});
            if (Rd_PerId != null && Rd_PerId != '') {
              var field_accounting_period = p_period;
              field_accounting_period.defaultValue = Rd_PerId;
              field_accounting_period.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }

            p_exrate.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

            // Seteo en el rellamado
            if (Rd_DepId != '' && Rd_DepId != null) {
              var field_department = c_depart;
              field_department.defaultValue = Rd_DepId;
              field_department.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }
            // Seteo en el rellamado
            if (Rd_ClaId != '' && Rd_ClaId != null) {
              var field_class = c_class;
              field_class.defaultValue = Rd_ClaId;
              field_class.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }
            // Seteo en el rellamado
            if (Rd_LocId != '' && Rd_LocId != null) {
              var field_location = c_location;
              field_location.defaultValue = Rd_LocId;
              field_location.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }
            // Seteo en el rellamado
            if (Rd_MetId != '' && Rd_MetId != null) {
              var field_paymethod = c_payMeth;
              field_paymethod.defaultValue = Rd_MetId;
              field_paymethod.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            }
          }

          // Seteo en el rellamado
          //modificacion argentina
          var licenses = allLicenses[Rd_SubId] || [];
          if (librarySend.getAuthorization(675, licenses) && (Rd_AccId == null || Rd_AccId == "")) {
            p_accountpay.isMandatory = false;
            p_accountpay.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED,
            });
            p_check.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED,
            });
          } else {

            if (Rd_AccId != '' && Rd_AccId != null) {
              p_accountpay.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED,
              });
              p_accountpay.defaultValue = Rd_AccId;
            }
          }

          // Seteo en el rellamado
          if (Rd_BacId != '' && Rd_BacId != null) {
            var field_bank = p_bank;
            field_bank.defaultValue = Rd_BacId;
            field_bank.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
          }

          var tab_a = form.addTab({ id: 'custpage_tab1', label: TabTrans });

          var featureMB = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
          log.error("multibook", featureMB);

          if (Rd_PayId != '' && Rd_PayId != null && subsi_OW && featureMB) {
            var currency_setup = setupTaxSubsiary.currency_setup;
            var currency_sub = search.lookupFields({ type: search.Type.SUBSIDIARY, id: Rd_SubId, columns: ['currency'] });
            currency_sub = currency_sub.currency[0].value;

            var multibooking_flag = false;
            if (currency_setup != currency_sub && currency_setup != Rd_CurId) {
              multibooking_flag = true;
            }

            if (multibooking_flag) {
              var tab_a = form.addTab({ id: 'custpage_tab2', label: LblMulti });

              var SubTabla_Book = form.addSublist({ id: 'custpage_id_sublista_book', type: serverWidget.SublistType.LIST, label: LblSublist, tab: 'custpage_tab2' });

              SubTabla_Book.addField({ id: 'custpage_id_book', label: LblBook, type: serverWidget.FieldType.TEXT });
              SubTabla_Book.addField({ id: 'custpage_id_currency', label: LblBaseCur, type: serverWidget.FieldType.TEXT });
              var ex_book = SubTabla_Book.addField({ id: 'custpage_id_rate_book', label: LblExRate, type: serverWidget.FieldType.FLOAT }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

              if (Rd_PayId != '' && Rd_PayId != null) {
                ex_book.isMandatory = true;

                var search_isocode = search.lookupFields({ type: search.Type.CURRENCY, id: currency_sub, columns: ['symbol'] });
                search_isocode = search_isocode.symbol;

                log.error('isocode', search_isocode);

                var search_book = record.load({ type: search.Type.SUBSIDIARY, id: Rd_SubId });

                var c_lineas = search_book.getLineCount({ sublistId: 'accountingbookdetail' });
                if (c_lineas > 0) {
                  for (var i = 0; i < c_lineas; i++) {
                    var name_book = search_book.getSublistText({ sublistId: 'accountingbookdetail', fieldId: 'accountingbook', line: i });
                    var currency_book = search_book.getSublistText({ sublistId: 'accountingbookdetail', fieldId: 'currency', line: i });
                    var status_book = search_book.getSublistText({ sublistId: 'accountingbookdetail', fieldId: 'bookstatus', line: i });
                    status_book = status_book.substring(0, 3);
                    status_book = status_book.toUpperCase();

                    if (status_book != 'ACT') {
                      continue;
                    }

                    var search_isocode_book = search.lookupFields({ type: search.Type.CURRENCY, id: search_book.getSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'currency', line: i }), columns: ['symbol'] });
                    search_isocode_book = search_isocode_book.symbol;

                    var rate = currency.exchangeRate({ source: search_isocode, target: search_isocode_book, date: new Date() });

                    SubTabla_Book.setSublistValue({ id: 'custpage_id_book', line: i, value: name_book });
                    SubTabla_Book.setSublistValue({ id: 'custpage_id_currency', line: i, value: currency_book });
                    SubTabla_Book.setSublistValue({ id: 'custpage_id_rate_book', line: i, value: rate });

                  }
                }

              }
            }
          }

          var SubTabla = form.addSublist({ id: 'custpage_id_sublista', type: serverWidget.SublistType.LIST, label: LblSublist, tab: 'custpage_tab1' });

          SubTabla.addField({ id: 'id_appl', label: LblApply, type: serverWidget.FieldType.CHECKBOX });
          SubTabla.addField({ id: 'id_int', label: LblInternalID, type: serverWidget.FieldType.TEXT });
          SubTabla.addField({ id: 'id_tran', label: LblTrans, type: serverWidget.FieldType.TEXT });
          SubTabla.addField({ id: 'id_date', label: LblDate, type: serverWidget.FieldType.DATE });
          SubTabla.addField({ id: 'id_vend', label: LblName, type: serverWidget.FieldType.TEXT });
          //modificacion argentina
          var licenses = allLicenses[Rd_SubId] || [];
          if (librarySend.getAuthorization(675, licenses) && (Rd_AccId == null || Rd_AccId == "")) {
            SubTabla.addField({
              id: "id_account",
              label: "AP Account",
              type: serverWidget.FieldType.SELECT,
              source: 'account'
            }).updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED,
            })
          }
          var document = SubTabla.addField({ id: 'id_doc', label: LblFiscalDoc, type: serverWidget.FieldType.SELECT, source: 'customrecord_lmry_tipo_doc' });
          document.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
          SubTabla.addField({ id: 'id_curn', label: LblCur, type: serverWidget.FieldType.TEXT });
          SubTabla.addField({ id: 'id_exch', label: LblExRate, type: serverWidget.FieldType.FLOAT });

          SubTabla.addField({ id: 'id_cred', label: 'BILL CREDIT', type: serverWidget.FieldType.FLOAT });
          SubTabla.addField({ id: 'id_json', label: 'JSON CREDIT', type: serverWidget.FieldType.TEXTAREA }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });;

          SubTabla.addField({ id: 'id_tota', label: LblTotalAm, type: serverWidget.FieldType.FLOAT });
          var desab = SubTabla.addField({
            id: 'id_amou', label: LblDueAm, type: serverWidget.FieldType.CURRENCY
          }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

          desab.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

          SubTabla.addField({
            id: 'id_pay', label: LblPay, type: serverWidget.FieldType.CURRENCY
          }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

          if ((Rd_SubId != null && Rd_SubId != '') && (Rd_CurId != null && Rd_CurId != '') && (Rd_PayId != null && Rd_PayId != '') && (librarySend.getAuthorization(675, licenses) || (Rd_AccId != null && Rd_AccId != ''))) {

            SubTabla.addButton({ id: 'id_mark', label: BtnMarkAll, functionName: 'markAll' });
            SubTabla.addButton({ id: 'id_desmark', label: BtnDesmarkAll, functionName: 'desmarkAll' });

            if (subsi_OW) {
              var Filter_Subs = search.createFilter({ name: 'subsidiary', operator: search.Operator.ANYOF, values: Rd_SubId });
            }
            var Filter_Curr = search.createFilter({ name: 'currency', operator: search.Operator.ANYOF, values: Rd_CurId });
            var Filter_Paye = search.createFilter({ name: 'entity', operator: search.Operator.ANYOF, values: Rd_PayId });
            var Filter_Acco = search.createFilter({ name: 'account', operator: search.Operator.ANYOF, values: Rd_AccId });
            var Filter_Date = search.createFilter({ name: 'trandate', operator: search.Operator.ONORBEFORE, values: Rd_DateId });
            var Filter_Hold = search.createFilter({ name: 'paymenthold', operator: search.Operator.IS, values: 'F' });

            // Busqueda personalizada : LatamReady - WHT Vendor Bill
            var search_transac = search.load({ id: 'customsearch_lmry_wht_vendor_bill' });

            if (subsi_OW) {
              search_transac.filters.push(Filter_Subs);
            }
            search_transac.filters.push(Filter_Curr);
            search_transac.filters.push(Filter_Paye);
            //modificacion argentina
            if (Rd_AccId != null && Rd_AccId != "") {
              search_transac.filters.push(Filter_Acco);
            }
            search_transac.filters.push(Filter_Date);
            search_transac.filters.push(Filter_Hold);

            //["formulanumeric: ABS({amount})-ABS({netamountnotax})","greaterthan","0"]
            //modificacion argentina
            if ((Rd_AccId == null || Rd_AccId == "") && librarySend.getAuthorization(675, licenses)) {
              var search_billcredit = search.create({
                type: "vendorcredit",
                filters: [
                  ["subsidiary", "anyof", Rd_SubId],
                  "AND",
                  ["currency", "anyof", Rd_CurId],
                  "AND",
                  ["entity", "anyof", Rd_PayId],
                  "AND",
                  ["mainline", "is", true],
                  "AND",
                  ["custbody_lmry_wht_details", "anyof", "@NONE@"],
                  "AND",
                  ["formulatext: {appliedtoforeignamount}", "isnotempty", ""],
                ],
                columns: [
                  { name: "internalid", sort: search.Sort.DESC },
                  {
                    name: "custrecord_lmry_transaction_f_exento",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_iva",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_gravado",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_no_gravado",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  { name: "internalid", join: "appliedToTransaction" },
                  "appliedtoforeignamount",
                  { name: "internalid", join: "CUSTRECORD_LMRY_TRANSACTION_F" },
                  "custbody_lmry_es_detraccion",
                ],
              });
            } else {
              var search_billcredit = search.create({
                type: "vendorcredit",
                filters: [
                  ["subsidiary", "anyof", Rd_SubId],
                  "AND",
                  ["currency", "anyof", Rd_CurId],
                  "AND",
                  ["entity", "anyof", Rd_PayId],
                  "AND",
                  ["account", "anyof", Rd_AccId],
                  "AND",
                  ["mainline", "is", true],
                  "AND",
                  ["custbody_lmry_wht_details", "anyof", "@NONE@"],
                  "AND",
                  ["formulatext: {appliedtoforeignamount}", "isnotempty", ""],
                ],
                columns: [
                  { name: "internalid", sort: search.Sort.DESC },
                  {
                    name: "custrecord_lmry_transaction_f_exento",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_iva",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_gravado",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  {
                    name: "custrecord_lmry_transaction_f_no_gravado",
                    join: "CUSTRECORD_LMRY_TRANSACTION_F",
                  },
                  { name: "internalid", join: "appliedToTransaction" },
                  "appliedtoforeignamount",
                  { name: "internalid", join: "CUSTRECORD_LMRY_TRANSACTION_F" },
                  "custbody_lmry_es_detraccion",
                ],
              });
            }

            var c = 0;
            var result_billcredit_run = search_billcredit.run();
            var result_billcredit = result_billcredit_run.getRange({ start: c, end: c + 1000 });

            var jsonCredit = {};

            if (result_billcredit != null && result_billcredit.length > 0) {
              var flag_billcredit = true;
              while (flag_billcredit) {
                for (var i = 0; i < result_billcredit.length; i++) {
                  var columnas = result_billcredit[0].columns;

                  var idBill = result_billcredit[i].getValue(columnas[5]);
                  var idCredit = result_billcredit[i].getValue(columnas[0]);
                  if (!jsonCredit.hasOwnProperty(idBill)) {
                    jsonCredit[idBill] = {};
                  }

                  jsonCredit[idBill][idCredit] = { 'amount': Math.abs(parseFloat(result_billcredit[i].getValue(columnas[6]))), 'exento': result_billcredit[i].getValue(columnas[1]) || 0, 'iva': result_billcredit[i].getValue(columnas[2]) || 0, 'gravado': result_billcredit[i].getValue(columnas[3]) || 0, 'nogravado': result_billcredit[i].getValue(columnas[4]) || 0, 'anticipo': result_billcredit[i].getValue(columnas[8]) };

                }

                if (result_billcredit.length == 1000) {
                  c = c + 1000;
                  result_billcredit = result_billcredit_run.getRange({ start: c, end: c + 1000 });
                } else {
                  flag_billcredit = false;
                }
              }
            }

            //log.error('jsonCredit',jsonCredit);

            var resul_transac = search_transac.run();
            var lengt_transac = resul_transac.getRange({ start: 0, end: 1000 });

            if (lengt_transac != null && lengt_transac.length > 0) {
              for (var i = 0; i < lengt_transac.length; i++) {
                searchresult = lengt_transac[i];
                // para usar campos de tipo formula
                var colFields = lengt_transac[i].columns;
                var exchan_rate = "" + searchresult.getValue({ name: colFields[5] });
                var intid = "" + searchresult.getText({ name: colFields[0] });
                var doc_fiscal = "" + searchresult.getValue({ name: colFields[12] });
                if (doc_fiscal != "") {
                  SubTabla.setSublistValue({ id: 'id_doc', line: i, value: doc_fiscal });
                }
                if (intid != "") {
                  SubTabla.setSublistValue({ id: 'id_int', line: i, value: intid });
                }
                var cdate = "" + searchresult.getValue({ name: colFields[10] });
                if (cdate != "") {
                  SubTabla.setSublistValue({ id: 'id_date', line: i, value: cdate });
                }
                var namev = "" + searchresult.getText({ name: colFields[1] });

                if (namev != "") {
                  SubTabla.setSublistValue({ id: 'id_vend', line: i, value: namev });
                }

                var namet = "" + searchresult.getValue({ name: colFields[7] });

                if (namet != "") {
                  SubTabla.setSublistValue({ id: 'id_tran', line: i, value: namet });
                }

                var curnt = "" + searchresult.getText({ name: colFields[3] });

                if (curnt != "") {
                  SubTabla.setSublistValue({ id: 'id_curn', line: i, value: curnt });
                }

                var exchang = "" + searchresult.getValue({ name: colFields[5] });
                if (exchang != "") {
                  SubTabla.setSublistValue({ id: 'id_exch', line: i, value: exchang });
                }

                var am_total = "" + searchresult.getValue({ name: colFields[8] });
                if (am_total != "") {
                  SubTabla.setSublistValue({ id: 'id_tota', line: i, value: am_total });
                }

                var amure = "" + searchresult.getValue({ name: colFields[6] });

                if (amure != "") {
                  amure = "" + searchresult.getValue({ name: colFields[13] });
                  SubTabla.setSublistValue({ id: 'id_amou', line: i, value: amure });
                }
                //modificacion argentina
                var account = searchresult.getValue({ name: colFields[14] })
                if (account != "" && account != null) {
                  SubTabla.setSublistValue({
                    id: "id_account",
                    line: i,
                    value: account,
                  });
                }

                //BILL CREDIT
                SubTabla.setSublistValue({ id: 'id_cred', line: i, value: 0 });
                if (jsonCredit.hasOwnProperty(intid)) {

                  var totalAmount = 0;
                  for (var j in jsonCredit[intid]) {
                    totalAmount += parseFloat(jsonCredit[intid][j]['amount']);
                  }

                  SubTabla.setSublistValue({ id: 'id_cred', line: i, value: totalAmount });
                  SubTabla.setSublistValue({ id: 'id_json', line: i, value: JSON.stringify(jsonCredit[intid]) });

                }


              }
            }
          }

          // Script Cliente
          form.clientScriptModulePath = './WTH_Library/LMRY_WHT_ON_Payments_CLNT.js';

          // Seteo en el rellamado
          if (Rd_PayId != '' && Rd_PayId != null) {
            form.addSubmitButton({ label: BtnSave });
            form.addButton({ id: 'id_cancel', label: BtnBack, functionName: 'funcionCancel' });
          } else {
            form.addSubmitButton({ label: BtnFiltrar });
          }
          form.addResetButton({ label: BtnReset });

          // Dibuja el fomulario
          context.response.writePage(form);
        } else {
          var _estado = context.request.parameters.id_state;

          if (_estado == '' || _estado == null) {
            var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
            var subsi = '1';
            if (subsi_OW) {
              subsi = context.request.parameters.custpage_id_subsi;
            }
            // realiza la consulta con los parametros seleccionados
            redirect.toSuitelet({
              scriptId: runtime.getCurrentScript().id,
              deploymentId: runtime.getCurrentScript().deploymentId,
              parameters: {
                'custparam_subsi': subsi,
                'custparam_curre': context.request.parameters.custpage_id_curren,
                'custparam_payee': context.request.parameters.custpage_id_payee,
                'custparam_accon': context.request.parameters.custpage_id_account_pay,
                'custparam_date': context.request.parameters.custpage_id_date,
                'custparam_bacco': context.request.parameters.custpage_id_bank,
                'custparam_acper': context.request.parameters.custpage_id_period,
                'custparam_exrat': context.request.parameters.custpage_id_rate,
                'custparam_depar': context.request.parameters.custpage_id_depart,
                'custparam_class': context.request.parameters.custpage_id_class,
                'custparam_locat': context.request.parameters.custpage_id_location,
                'custparam_metho': context.request.parameters.custpage_id_method
              }
            });

          } else {
            //ejecutando el post del suitelet principal
            log.error({ title: "Estado", details: "Envio al Preview" });
            var usuario = runtime.getCurrentUser().id;
            var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

            var dataLog = context.request.parameters.custpage_data_log || "";
            if (dataLog) {
              log.debug("dataLog", dataLog);
              dataLog = JSON.parse(dataLog);
              var logIds = [];

              var _date = context.request.parameters.custpage_id_date;
              log.debug("_date", _date);
              _date = format.parse({
                value: _date,
                type: format.Type.DATE
              });

              for (var i = 0; i < dataLog.length; i++) {
                var logObj = dataLog[i];
                var wht_log = record.create({
                  type: 'customrecord_lmry_wht_payments_log',
                  isDynamic: true
                });

                if (logObj.mbook) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_mul', value: logObj.mbook });
                }

                if (logObj.subsidiary) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_sub', value: logObj.subsidiary });
                }

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_sta', value: 'Preview' });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_ven', value: logObj.vendor || "" });

                wht_log.setValue({
                  fieldId: "custrecord_lmry_wht_bil",
                  value: logObj.bills
                });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_doc', value: logObj.doc });

                //modificacion argentina

                wht_log.setValue({
                  fieldId: "custrecord_lmry_wht_acc",
                  value: logObj.apaccount || ""
                });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cur', value: logObj.currency });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_ban', value: logObj.bankAcc || "" });

                // log.debug("_date", logObj.date);
                // var _date = new Date(logObj.date);
                // log.debug("_date",_date);
                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_dat', value: _date });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_per', value: logObj.period || "" });

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_exc', value: logObj.rate });

                var check = logObj.check || "";
                check = check.trim();

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_che', value: check });

                if (logObj.eft) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_eft', value: logObj.eft });
                }

                /*if (UserID != null && UserID != '')
                {
                    wht_log.setValue ({ fieldId: 'custrecord_lmry_wht_emp', value :  UserID});
                }*/

                if (logObj.memo) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_mem', value: logObj.memo });
                }

                var department = logObj.department || "";
                if (Number(department)) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_dep', value: department });
                }

                var location = logObj.location || "";
                if (Number(location)) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_loc', value: location });
                }

                var class_ = logObj.cla || "";
                if (Number(class_)) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cla', value: class_ });
                }

                wht_log.setValue({ fieldId: 'custrecord_lmry_wht_met', value: logObj.method || "" });

                if (logObj.credits && Object.keys(logObj.credits).length) {
                  wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cre', value: JSON.stringify(logObj.credits) });
                }

                // Graba Log
                var logid = wht_log.save();
                logIds.push(logid);
              }

              log.debug("logIds", JSON.stringify(logIds));

              // realiza la consulta con los parametros seleccionados
              if (logIds.length == 1) {
                redirect.toSuitelet({
                  scriptId: "customscript_lmry_wht_details_stlt",
                  deploymentId: "customdeploy_lmry_wht_details_stlt",
                  parameters: { param_logid: logIds[0], param_useid: usuario },
                });
              }
              if (logIds.length > 1) {
                redirect.toSuitelet({
                  scriptId: "customscript_ltmr_ar_wht_details_stlt",
                  deploymentId: "customdeploy_ltmr_ar_wht_details_stlt",
                  parameters: { param_logid: logIds.join(","), param_useid: usuario },
                });
              }
            }


          }
        }
      } catch (msgerr) {

        var form = serverWidget.createForm({ title: 'LatamTAX - Bill Payments' });
        var myInlineHtml = form.addField({
          id: 'custpage_id_message',
          label: LblTittleMsg,
          type: serverWidget.FieldType.INLINEHTML
        });
        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
        myInlineHtml.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

        var strhtml = "<html>";
        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
        strhtml += "<tr>";
        strhtml += "</tr>";
        strhtml += "<tr>";
        strhtml += "<td class='text'>";
        strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
        strhtml += LblMsg3 + ".<br><br>";
        strhtml += "<br>Code :" + xml.escape(msgerr.name);
        strhtml += "<br>Details :" + xml.escape(msgerr.message);
        strhtml += "</div>";
        strhtml += "</td>";
        strhtml += "</tr>";
        strhtml += "</table>";
        strhtml += "</html>";

        // Mensaje HTML
        myInlineHtml.defaultValue = strhtml;

        // Dibuja el Formulario
        context.response.writePage(form);
        log.error({ title: 'Se generó un error en suitelet', details: msgerr });
        lbryLog.doLog({ title: "[ onRequest ]", message: msgerr });

        // Envio de mail al clientes
        library.sendMail(LMRY_script, '[ onRequest ] ' + msgerr);
      }
    }

    return {
      onRequest: onRequest
    };

  });
