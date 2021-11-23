/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BoletoBancarioBBLBRY_V2.0.js  				      ||
||                                                              ||
||  Version   Date         Author        Remarks                ||
||  2.0     Feb 25 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/record', 'N/file', 'N/record', 'N/render', 'N/url', 'N/log', 'N/xml', 'N/https', 'N/search', 'N/format', 'N/format/i18n', './LMRY_libSendingEmailsLBRY_V2.0', 'N/config', 'N/runtime'],
  function(record, file, record, render, url, log, xml, https, search, format, format2, libraryMail, config, runtime) {

    var LMRY_script = 'LMRY_BoletoBancarioBBLBRY_V2.0.js';

    var ST_FEATURE = false;

    //Datos de la Subsidiaria/Beneficiario
    var nomSubsidiaria = '';
    var cnpjSubsidiaria = '';
    var cnpjSubsidiari_modif = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer1 = '';
    var addressCustomer2 = '';

    //Datos del Invoice
    var dateInvoice = ''; //Data do documento , Data Processamento
    var dueDateInvoice = ''; //Vencimento
    var dataVencimiento = '';
    var montoTotalInvoice = ''; //Valor do Documento
    var nroDoc = ''; //Núm. do documento
    var agenciaCodBeneficiario = '';

    var anulado = '';
    var codOcurencia = '';

    var especieDoc = '';
    var nossoNumero = '';

    var especieMoneda = '';
    var instructions = '';

    var codigoBarras = '';
    var codigoMoneda = '';
    var lineaDigital = '';

    var urlBoletoBancarioPdf = '';
    var shortLink = '';

    //Datos config: Subsidiaria - Banco ITAU
    var lugarPago = '';
    var agencia = '';
    var codigoBeneficiario = '';
    var aceptacion = ''; //Aceite
    var cartera = ''; //Carteira

    var codigoBanco = '';
    var digitoVerificadorBanco = '';
    var nossoCorrelativo = '';
    var custom_field = '';

    var id_logoBB = '';
    var licenses = [];
    var id_folder_br_ei = '';
    var host = '';
    var boletos = [];
    var flag = false;

    //Url de web service acortador de link
    const WS_URL = 'https://tstdrv1930452.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=692&deploy=1&compid=TSTDRV1930452&h=42860c3b2ce293fa7084';

    function obtenerURLPdfBoletoBancario(id_invoice, record_id, status, installment, type) {

      try {
        codOcurencia = status;
        var Language = runtime.getCurrentScript().getParameter({
          name: 'LANGUAGE'
        });
        Language = Language.substring(0, 2);

        switch (Language) {
          case 'pt':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:150px;color:alpha(8%,#ff0000)">PEDIDO DE BAIXA</p>';
            break;
          case 'es':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:140px;color:alpha(8%,#ff0000)">SOLICITUD DE BAJA</p>';
            break;
          default:
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:130px;color:alpha(8%,#ff0000)">WRITE OFF REQUEST</p>';
        }

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: id_invoice,
          columns: ['subsidiary', 'entity', 'trandate', 'duedate', 'custbody_lmry_num_preimpreso', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount', 'currency']
        });

        var subsidiary = recordInvoice.subsidiary[0].value;
        var customer = recordInvoice.entity[0].value;

        dateInvoice = recordInvoice.trandate
        dateInvoice = formatoFecha(dateInvoice);

        dataVencimiento = recordInvoice.duedate;
        if (dataVencimiento) {
          dueDateInvoice = formatoFecha(dataVencimiento);
        }

        nroDoc = recordInvoice.custbody_lmry_num_preimpreso;

        var moneda = recordInvoice.currency[0].value;

        montoTotalInvoiceValue = recordInvoice.fxamount;
        //Parseando el montoTotalInvoiceValue a float
        var numberMonto = format.parse({
          value: montoTotalInvoiceValue,
          type: format.Type.FLOAT
        });


        var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
        montoTotalInvoiceText = numFormatter1.format({
          number: numberMonto
        });

        licenses = libraryMail.getLicenses(subsidiary);

        /******************************************************************+******************************************
                      - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
                        Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
        ***************************************************************************************************************/
        var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

        if (libraryMail.getAuthorization(416, licenses) == true && tax_code_des == 'Latam - WHT Tax') {
          flag = true;
          var retencion = recordInvoice.custbody_lmry_wtax_amount;

          montoTotalInvoiceValue = montoTotalInvoiceValue - retencion;

          var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
          montoTotalInvoiceText = numFormatter1.format({
            number: montoTotalInvoiceValue
          });

          montoTotalInvoiceValue = montoTotalInvoiceValue.toFixed(2);
        }
        // ****************************************************************************************************************


        obtenerDatosSubsidiaria(subsidiary, id_invoice);
        obtenerDatosCustomer(customer, id_invoice);
        obtenerDatosConfigSubsidiariaBancoBB(record_id, moneda);
        formarNossoNumero(id_invoice, record_id, nossoCorrelativo);
        obtenerEspecieDOC(id_invoice);
        formandoInstrucciones(id_invoice);

        //Nombre del Dominio del Ambiente
        host = url.resolveDomain({
          hostType: url.HostType.APPLICATION
        });

        //************** INICIO - Formando El URL del Logo de Banco do Brasil ***********
        if (id_logoBB != '' && id_logoBB != null) {
          url_logo = 'https://' + host + file.load(id_logoBB).url;
        } else {
          url_logo = 'https://tstdrv1038906.app.netsuite.com/core/media/media.nl?id=1048674&c=TSTDRV1038906&h=b1bf420f1e8250e648b0&fcts=20200228063858&whence=';
        }

        //Crea la carpeta "Latam BR - PDF Boleto Bancario" si no existe, en dicha carpeta se guardaran los Boletos Bancarios
        search_folder();

        boletos = formarInstallments(id_invoice, installment, type);
        return boletos;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerURLPdfBoletoBancarioBB ] ' + err, LMRY_script);
      }
    }

    function formarInstallments(id_invoice, installment, type) {
      try {
        var linkBoleto = '';
        var arrayBoletos = [];
        //Se obtiene el Id de la carpeta "Latam BR - PDF Boleto Bancario"
        id_folder_br_ei = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });

        if (id_folder_br_ei) {
          linkBoleto = formarPDF(montoTotalInvoiceValue, montoTotalInvoiceText, '', id_invoice);
          arrayBoletos.push(linkBoleto);

          var installments = runtime.isFeatureInEffect({
            feature: "installments"
          });

          if (installments && libraryMail.getAuthorization(536, licenses)) {
            var jsonInstallments = [];

            if (installment != '' && installment != null) {
              jsonInstallments = JSON.parse(installment);
            }

            if (Object.keys(jsonInstallments).length) {
              for (var idInstallment in jsonInstallments) {
                var monto = Math.round(parseFloat(jsonInstallments[idInstallment]['amount']) * 100) / 100;

                if (jsonInstallments[idInstallment]['wht'] && flag) {
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  monto = Math.round((parseFloat(monto) - parseFloat(retencion)) * 100) / 100;
                }

                var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                montoText = numFormatter1.format({
                  number: monto
                });

                monto = monto.toFixed(2);

                if (jsonInstallments[idInstallment]['duedate']) {
                  dataVencimiento = jsonInstallments[idInstallment]['duedate'];
                  dueDateInvoice = formatoFecha(jsonInstallments[idInstallment]['duedate']);
                }

                var link = formarPDF(monto, montoText, idInstallment, id_invoice);
                arrayBoletos.push(link);
              }
            } else {
              var searchInstallments = search.create({
                type: "invoice",
                filters: [
                  ["internalid", "anyof", id_invoice], "AND",
                  ["mainline", "is", "T"]
                ],
                columns: [
                  search.createColumn({
                    name: "installmentnumber",
                    join: "installment",
                    sort: search.Sort.ASC
                  }),
                  "installment.amount",
                  "installment.duedate"
                ],
                settings: [search.createSetting({
                  name: 'consolidationtype',
                  value: 'NONE'
                })]
              });

              var resultInstallments = searchInstallments.run().getRange(0, 100);

              var row = resultInstallments[0].columns;
              var installNumber = resultInstallments[0].getValue(row[0]);

              if (resultInstallments != null && resultInstallments != '' && installNumber != '' && installNumber != null) {
                for (var i = 0; i < resultInstallments.length; i++) {
                  var row = resultInstallments[i].columns;
                  var internalId = resultInstallments[i].getValue(row[0]);
                  var monto = resultInstallments[i].getValue(row[1]);
                  var duedate = resultInstallments[i].getValue(row[2]);
                  monto = parseFloat(monto);

                  //Parseando el monto a float
                  var numberMonto = format.parse({
                    value: monto,
                    type: format.Type.FLOAT
                  });

                  var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                  var montoText = numFormatter1.format({
                    number: numberMonto
                  });

                  monto = monto.toFixed(2);

                  if (duedate) {
                    dataVencimiento = duedate;
                    dueDateInvoice = formatoFecha(duedate);
                  }

                  var link = formarPDF(monto, montoText, internalId, id_invoice);
                  arrayBoletos.push(link);

                }
              }
            }
          }
          //}
          if (type == '1') {
            record.submitFields({
              type: 'invoice',
              id: id_invoice,
              values: {
                'custbody_lmry_informacion_adicional': arrayBoletos
              },
              options: {
                ignoreMandatoryFields: true,
                enableSourcing: true,
                disableTriggers: true
              }
            });
          }

          return arrayBoletos;
        }
      } catch (err) {
        libraryMail.sendemail(' [ formarInstallments ] ' + err, LMRY_script);
      }
    }

    function formarPDF(monto, montoText, cod, id_invoice) {
      try {
        var shortLink = '';
        obtenerCodigoBarras(monto);
        obtenerLineaDigital();

        var htmlFinal = '';
        htmlFinal += reciboPagador(montoText);
        htmlFinal += fichaCompensacion(montoText);

        var xml = "<?xml version=\"1.0\"?><!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">";
        xml += "<pdf> <head> <macrolist><macro id=\"marca\">" + anulado + "</macro></macrolist>";
        if (codOcurencia == 2) {
          xml += "</head><body font-size=\"12\" size=\"A4\" background-macro=\"marca\"><h3></h3>";
        } else {
          xml += "</head><body font-size=\"12\" size=\"A4\"><h3></h3>";
        }
        xml += htmlFinal;
        xml += "</body> </pdf>";

        var myFileObj = render.xmlToPdf({
          xmlString: xml
        });

        //Nombre del Boleto Bancario
        if (cod != '') {
          myFileObj.name = 'BR_BB_BB_' + id_invoice + '_' + cod + '.pdf';
        } else {
          myFileObj.name = 'BR_BB_BB_' + id_invoice + '.pdf';
        }

        myFileObj.folder = id_folder_br_ei;
        myFileObj.isOnline = true;
        var id_pdf = myFileObj.save();

        var url_archivo_pdf = file.load({
          id: id_pdf
        });
        var urlBoletoBancarioPdf = 'https://' + host + url_archivo_pdf.url;
        //Acortador del link
        var account = runtime.accountId;
        shortLink = libraryMail.acortadorDeLink(WS_URL, urlBoletoBancarioPdf, account);
        return shortLink;

      } catch (err) {
        libraryMail.sendemail(' [ formarPDF ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosConfigSubsidiariaBancoBB(record_id, currency) {
      //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsidiaria - Banco do Brasil
      var searchConfigSubsiBank = search.create({
        type: 'customrecord_lmry_br_config_bank_ticket',
        columns: [{
          name: 'custrecord_lmry_beneficiary_code'
        }, {
          name: 'custrecord_lmry_code_bank'
        }, {
          name: 'custrecord_lmry_bank_agency'
        }, {
          name: 'custrecord_lmry_bank_place_of_payment'
        }, {
          name: 'custrecord_lmry_bank_code_cartera'
        }, {
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        }, {
          name: 'custrecord_lmry_bank_check_digit'
        }, {
          name: 'custrecord_lmry_br_docu_specie_siglas',
          join: 'CUSTRECORD_LMRY_BANK_ESPECIE_DOC',
          label: "BR Siglas"
        }, {
          name: 'internalid'
        }, {
          name: 'custrecord_lmry_id_field'
        }, {
          name: 'custrecord_lmry_bank_logo'
        }, {
          name: 'custrecord_lmry_nossonumero_correlative'
        }],
        filters: ['internalid', 'is', record_id]
      });
      var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

      if (searchResult != '' && searchResult != null) {
        var columns = searchResult[0].columns;

        codigoBeneficiario = searchResult[0].getValue(columns[0]);
        codigoBanco = searchResult[0].getValue(columns[1]);
        var agencia = searchResult[0].getValue(columns[2]);

        if (agencia) {
          agenciaCodBeneficiario = agencia + " / " + codigoBeneficiario;

        } else {
          agenciaCodBeneficiario = codigoBeneficiario;
        }

        lugarPago = searchResult[0].getValue(columns[3]);
        cartera = searchResult[0].getValue(columns[4]);

        aceptacion = searchResult[0].getValue(columns[5]);

        if (aceptacion != null && aceptacion != '') {
          if (aceptacion == 1) {
            aceptacion = "A";
          } else {
            aceptacion = "N";
          }
        }

        digitoVerificadorBanco = searchResult[0].getValue(columns[6]);

        especieDoc = searchResult[0].getValue(columns[7]);
        var id_config_bank_ticket = searchResult[0].getValue(columns[8]);

        //Campo personalizado para la impresión en las instrucciones del PDF, que puede contener: ID de campos de tipo custbody, Texto libre y salto de linea(enter)
        custom_field = searchResult[0].getValue(columns[9]);

        //Logo de Banco
        id_logoBB = searchResult[0].getValue(columns[10]);

        //Correlativo para formar el Nosso Número
        nossoCorrelativo = searchResult[0].getValue(columns[11]);

        if (id_config_bank_ticket != null && id_config_bank_ticket != null) {
          var searchConfigCurrency = search.create({
            type: 'customrecord_lmry_br_config_currency',
            columns: [{
              name: 'custrecord_lmry_br_config_currency_name'
            }, {
              name: 'custrecord_lmry_br_config_currency_cod'
            }, {
              name: 'custrecord_lmry_br_config_currency_form'
            }],
            filters: ['custrecord_lmry_br_config_currency_bank', 'is', id_config_bank_ticket]
          });
          var searchResultCurrency = searchConfigCurrency.run().getRange(0, 1000);
          if (searchResultCurrency != '' && searchResultCurrency != null) {
            for (var j = 0; j < searchResultCurrency.length; j++) {

              var name_currency = searchResultCurrency[j].getValue({
                name: 'custrecord_lmry_br_config_currency_name'
              });

              if (name_currency == currency) {
                var code_currency = searchResultCurrency[j].getValue({
                  name: 'custrecord_lmry_br_config_currency_cod'
                });
                var format_currency = searchResultCurrency[j].getValue({
                  name: 'custrecord_lmry_br_config_currency_form'
                });
                codigoMoneda = code_currency;
                especieMoneda = format_currency;

              }
            }

          }
        }
      }
    }

    function reciboPagador(monto) {
      var html = "";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:0px\">";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\" style=\"font-size:6.8pt;color:#204EA5; padding-left:0px\">Corte na linha pontilhada</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style = \"border-bottom:0.8px dashed\" colspan=\"7\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"right\" style=\"font-size:7.8pt; padding-left:570px; padding-right:0px; padding-top:0px; padding-bottom:0px\">Recibo do Pagador</td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;margin-top:0px; border-bottom:1.5px solid #173889; padding-top:0px\" >";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\" colspan=\"1\" width=\"20%\" style=\"padding-left:0px;padding-bottom: 4px;padding-right:0px \"><img  src=\"" + xml.escape(url_logo) + "\" width=\"120\" height=\"15\"/></td>";
      html += "<td valign=\"bottom\"  colspan=\"1\" width=\"10%\">  <p style=\"border-left:4px solid #D2D4D4; border-right:4px solid #D2D4D4;  padding-bottom: -2px; padding-left:12px ;padding-right:12px; padding-top:9px; font-size:3mm\">  <b> " + codigoBanco + "-" + digitoVerificadorBanco + "</b> </p></td>";
      html += "<td valign=\"bottom\"  align=\"right\" colspan=\"5\" width=\"80%\"> <p style=\"padding-bottom: -2px; font-size:3mm \"> <b>" + lineaDigital + " </b> </p></td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:0px;\">";
      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5; border-color:#F2C312; border-left:4px; padding-bottom:0px\" align=\"left\" colspan=\"1\">Nome do Pagador/CPF/CNPJ/Endereço</td>";
      html += "<td colspan=\"5\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 8pt ;border-color:#F2C312;border-left:4px;padding-bottom:0px; padding-top:0px; text-transform: uppercase\" align=\"left\" colspan=\"2\">" + nomCustomer + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px\" align=\"left\">" + cnpjCustomer + "</td>";
      //  html += "<td colspan=\"4\" align=\"left\"> </td>";
      //  html += "<td style=\"font-size: 9pt; border-right:1px;\" colspan=\"1\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 8pt;border-color:#F2C312;border-left:4px;padding-bottom:0px;padding-top:0px; text-transform: uppercase\" colspan=\"6\" align=\"left\">" + addressCustomer1 + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 8pt;border-color:#F2C312;border-left:4px;padding-top:0px; text-transform: uppercase\" colspan=\"6\" align=\"left\">" + addressCustomer2 + "</td>";
      html += "</tr>";

      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5;border-color:#F2C312;border-left:4px;padding-bottom:0px; padding-top:0px\" colspan=\"1\">Sacador/Avalista</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px;\" align=\"left\" colspan=\"1\">" + cnpjSubsidiari_modif + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px;text-transform: uppercase\" align=\"left\" colspan=\"4\">" + nomSubsidiaria + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Nosso Número</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Nº do documento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Data de Vencimento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Valor do Documento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\" >(=)Valor Pago</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + nossoNumero + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + nroDoc + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + dueDateInvoice + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + monto + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"2\"></td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\" align=\"left\">Nome do Beneficiário/CNPJ/CPF</td>";
      //html += "<td colspan=\"5\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 8pt ;border-color:#F2C312;border-left:4px;padding-bottom:0px;text-transform: uppercase\" align=\"left\" colspan=\"2\">" + nomSubsidiaria + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px\" align=\"left\">" + cnpjSubsidiaria + "</td>";
      //html += "<td colspan=\"4\" align=\"left\"> </td>";
      //  html += "<td style=\"font-size: 9pt; border-right:1px;\" colspan=\"1\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5;border-color:#F2C312;border-left:4px\" colspan=\"4\">Agência / Código do Beneficiário</td>";
      //  html += "<td colspan=\"3\" align=\"left\"> </td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\">Autenticação mecânica</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 9pt;border-color:#F2C312;border-left:4px\" colspan=\"4\" align=\"left\">" + agenciaCodBeneficiario + " </td>";
      //  html += "<td colspan=\"3\" align=\"left\" style=\"border-bottom:1px;\" > </td>";
      html += "<td style=\"font-size: 9pt; border-color:#F2C312;border-left:4px\" colspan=\"2\" align=\"left\"></td>";
      html += "</tr>"

      html += "</table>";
      return html;

    }

    function fichaCompensacion(monto) {
      var html = "";
      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:0px\">";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\" style=\"font-size:6.8pt;color:#204EA5; padding-left:0px; padding-bottom:20px\">Corte na linha pontilhada</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style = \"border-bottom:0.8px dashed\" colspan=\"7\"> </td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;margin-top:15px; border-bottom:1.5px solid #173889;padding-top:0px\" >";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\" colspan=\"1\" width=\"20%\" style=\"padding-left:0px;padding-bottom: 4px;padding-right:0px \"><img  src=\"" + xml.escape(url_logo) + "\" width=\"120\" height=\"15\"/></td>";
      html += "<td valign=\"bottom\"  colspan=\"1\" width=\"10%\">  <p style=\"border-left:4px solid #D2D4D4; border-right:4px solid #D2D4D4;  padding-bottom: -2px; padding-left:12px ;padding-right:12px; padding-top:9px; font-size:3mm\">  <b> " + codigoBanco + "-" + digitoVerificadorBanco + "</b> </p></td>";
      html += "<td valign=\"bottom\"  align=\"right\" colspan=\"5\" width=\"80%\"> <p style=\"padding-bottom: -2px; font-size:3mm \"> <b>" + lineaDigital + " </b> </p></td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; align:center; width:100%;height:95mm\">";

      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\">Local de Pagamento</td>";
      html += "<td colspan=\"4\" align=\"left\"> </td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\">Data de Vencimento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 9pt;border-color:#F2C312;border-left:4px\" colspan=\"5\" align=\"left\">" + reemplazarCaracteresEspeciales(lugarPago) + "</td>";
      html += "<td style=\"font-size: 9pt; border-color:#F2C312;border-left:4px\" colspan=\"2\" align=\"right\">" + dueDateInvoice + "</td>";
      html += "</tr>"

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"5\" align=\"left\">Nome do Beneficiário/CNPJ/CPF</td>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\" align=\"left\">Agência/Código do Beneficiário</td>";
      //html += "<td colspan=\"5\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 8pt ;border-color:#F2C312;border-left:4px;padding-bottom:0px;text-transform: uppercase\" align=\"left\" colspan=\"2\">" + nomSubsidiaria + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px\" colspan=\"1\" align=\"left\">" + cnpjSubsidiaria + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px\" colspan=\"2\" align=\"left\"></td>";
      html += "<td style=\"font-size: 8pt;border-color:#F2C312;border-left:4px;padding-bottom:0px\" colspan=\"2\"  align=\"right\">" + agenciaCodBeneficiario + "</td>";
      //html += "<td colspan=\"4\" align=\"left\"> </td>";
      //  html += "<td style=\"font-size: 9pt; border-right:1px;\" colspan=\"1\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Data do documento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Nº do documento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Espécie DOC.</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Aceite</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Data Processamento</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\" >Nosso Número</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + dateInvoice + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + nroDoc + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + especieDoc + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + aceptacion + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + dateInvoice + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"right\" colspan=\"2\">" + nossoNumero + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Uso do Banco </td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Carteira </td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px \" colspan=\"1\" >Espécie</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >Quantidade</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"1\" >xValor</td>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px\" colspan=\"2\" >(=) Valor do documento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\"></td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + cartera + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\">" + especieMoneda + "</td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\"></td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"1\"></td>";
      html += "<td style=\"font-size: 8pt; border-color:#F2C312;border-left:4px\" align=\"right\" colspan=\"2\">" + monto + "</td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6.8pt\" colspan=\"5\" rowspan=\"6\"> <p style=\"font-size:6.8pt;color:#204EA5\" >Informações de responsabilidade do beneficiário</p> <p style=\"font-size:9pt; \"> " + instructions + "</p>  </td>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5;border-color:#F2C312;border-left:4px\" colspan=\"2\">(-) Desconto / Abatimento</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt; border-left: 4px solid #F2C312; border-bottom:1px solid #173889; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6.8pt; color:#204EA5;border-color:#F2C312;border-left:4px\" colspan=\"2\">(+) Mora / Multa</td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size: 9pt; border-left: 4px solid #F2C312; border-bottom:1px solid #173889; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6.8pt; color:#204EA5;border-color:#F2C312;border-left:4px\" colspan=\"2\">(=) Valor Cobrado</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px solid #173889\" >";
      html += "<td style=\"font-size: 9pt; min-height:16px; border-color:#F2C312;border-left:4px\" align=\"left\" colspan=\"2\" ></td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; color:#204EA5; border-color:#F2C312;border-left:4px; padding-bottom:0px\" align=\"left\" colspan=\"1\">Nome do Pagador/CPF/CNPJ/Endereço</td>";
      html += "<td colspan=\"6\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 8pt ;border-color:#F2C312;border-left:4px;padding-bottom:0px; padding-top:0px; text-transform: uppercase\" align=\"left\" colspan=\"2\">" + nomCustomer + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px\" align=\"left\">" + cnpjCustomer + "</td>";
      //  html += "<td colspan=\"4\" align=\"left\"> </td>";
      //  html += "<td style=\"font-size: 9pt; border-right:1px;\" colspan=\"1\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 8pt;border-color:#F2C312;border-left:4px;padding-bottom:0px;padding-top:0px; text-transform: uppercase\" colspan=\"7\" align=\"left\">" + addressCustomer1 + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 8pt;border-color:#F2C312;border-left:4px;padding-top:0px; text-transform: uppercase\" colspan=\"7\" align=\"left\">" + addressCustomer2 + "</td>";
      html += "</tr>";

      html += "<tr style=\"border-bottom:1px solid #173889\">";
      html += "<td style=\"font-size: 6.8pt ; color:#204EA5;border-color:#F2C312;border-left:4px;padding-bottom:0px; padding-top:0px\" colspan=\"1\">Sacador/Avalista</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px;\" align=\"left\" colspan=\"1\">" + cnpjSubsidiari_modif + "</td>";
      html += "<td style=\"font-size: 8pt;padding-bottom:0px; padding-top:0px;text-transform: uppercase\" align=\"left\" colspan=\"5\">" + nomSubsidiaria + "</td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:0px\">";
      html += "<tr>";
      html += "<td style=\"font-size: 6.8pt; color:#204EA5;padding-top:2px;padding-bottom:10px;padding-right:0px\" align=\"right\">Autenticação mecânica - Ficha de Compensação</td>";
      html += "</tr>";
      html += "<tr>";
      html += "</tr>";
      html += "</table>";

      //codigo de barras
      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:left;\">";
      html += "<tr>";
      html += "<td valign=\"middle\" align=\"left\" style=\"padding-left:-12px\"> <barcode codetype=\"code128\" showtext=\"false\" value=\"" + codigoBarras + "\" width=\"103mm\" height=\"13mm\"/> </td>";
      html += "</tr>";
      html += "</table>";

      return html;

    }

    function obtenerDatosSubsidiaria(id_subsidiaria, id_invoice) {
      if (id_subsidiaria != '' && id_subsidiaria != null) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var subsidiaria = record.load({
          type: record.Type.SUBSIDIARY,
          id: id_subsidiaria,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: id_invoice,
            isDynamic: true
          });
          var transaction_nexys = transObj.getValue({fieldId: 'nexus'});
          var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var subsidiary_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(transaction_nexys === subsidiary_nexus){
              var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        //NOMBRE DE LA SUBSIDIARIA
        var nom_subsidiaria = subsidiaria.getValue({ fieldId: 'legalname' });
        if (nom_subsidiaria) {
          nomSubsidiaria = nom_subsidiaria.substring(0, 30);
          nomSubsidiaria = reemplazarCaracteresEspeciales(nomSubsidiaria);
        }

        //CNPJ DE LA SUBSIDIARIA
        var cnpj_subsidiaria = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_subsidiaria = subsidiaria.getValue({ fieldId: 'federalidnumber' });
        } else {
          cnpj_subsidiaria = subsidiary_cnpj;
        }
        if (cnpj_subsidiaria)
          cnpjSubsidiaria = reemplazarCaracteresEspeciales(cnpj_subsidiaria);
      }

      //CNPJ concatenado
      cnpjSubsidiari_modif = cnpjSubsidiaria.replace(/\.|\-|\//g, '');

      return true;
    }

    function obtenerDatosCustomer(id_customer, internalId) {
      if (id_customer != null && id_customer != '') {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: internalId,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: id_customer,
          columns: customer_columns
        });
        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson;

        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T' || typeCustomer == true) {
          var firtsName = recordCustomer.firstname;
          var lastName = recordCustomer.lastname;

          nom_customer = firtsName + ' ' + lastName

        } else {
          nom_customer = recordCustomer.companyname;
        }

        // NOMBRE DEL CLIENTE
        if (nom_customer) {
          nomCustomer = nom_customer.substring(0, 30);
          nomCustomer = reemplazarCaracteresEspeciales(nomCustomer);
        }

        //CNPJ DEL CLIENTE
        var cnpj_customer = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_customer = recordCustomer.vatregnumber;
        } else {
          cnpj_customer = customer_cnpj;
        }
        if (cnpj_customer)
          cnpjCustomer = reemplazarCaracteresEspeciales(cnpj_customer);


        // DIRECCIÓN DEL CLIENTE
        var billAdress1 = '';
        // Numero de la direccion
        var billAdress2 = '';
        // Complemento
        var billAdress3 = '';
        // Barrio
        var billAdress4 = '';
        // Ciudad
        var billAdress5 = '';
        // Provincia
        var billAdress6 = '';
        // Zip
        var billAdress7 = '';
        // Country
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", internalId],
            "AND",
            ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          // Numero de la direccion
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress2 == '' || billAdress2 == null) {
            billAdress2 = '';
          }

          // Complemento
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          // Barrio
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }

          // Ciudad
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }

          // Provincia
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }

          // Zip
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }

          billAdress7 = billAdress7.replace(/[^0-9]/g, '');

          // Country
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }

        }

        // Arma la direccion  (primera fila)
        var address_customer1 = billAdress1 + ' ' + billAdress2 + ' ' + billAdress3 + ' ' + billAdress4 + ' ' + billAdress8;

        if (address_customer1) {
          addressCustomer1 = reemplazarCaracteresEspeciales(address_customer1);
        }

        // Arma la direccion  (segunda fila)
        var address_customer2 = billAdress5;

        if (billAdress6 != '') {
          if (address_customer2 != '') {
            address_customer2 = address_customer2 + '-' + billAdress6;
          } else {
            address_customer2 = billAdress6;
          }
        }

        if (billAdress7 != '') {
          if (address_customer2 != '') {
            address_customer2 = address_customer2 + '-' + billAdress7;
          } else {
            address_customer2 = billAdress7;
          }
        }

        if (address_customer2 != '') {
          addressCustomer2 = reemplazarCaracteresEspeciales(address_customer2);
        }

      }

      return true;

    }

    function formatoFecha(fecha) {
      try {

        var formatoFecha = '';

        fecha = format.parse({
          value: fecha,
          type: format.Type.DATE
        });

        var day = fecha.getDate();
        day = day.toString();
        if (day.length == 1) {
          day = '0' + day
        }

        var month = fecha.getMonth() + 1;
        month = month.toString();
        if (month.length == 1) {
          month = '0' + month
        }

        var year = fecha.getFullYear();

        formatoFecha = day + '/' + month + '/' + year;
        return formatoFecha;
      } catch (err) {
        libraryMail.sendemail(' [ formatoFecha ] ' + err, LMRY_script);
      }
    }

    function formarNossoNumero(id_invoice, record_id, nossoCorrelativo) {
      try {

        var llenarCeros = '';
        var maxLimit = 10;
        var nossoFijo = '2726615';
        var brNossoNumero = '';
        var nossoNumCorrelativo;
        var idTransactionFields = '';

        var searchTransactionField = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: [{
            name: 'internalid'
          }, {
            name: 'custrecord_lmry_br_nosso_numero'
          }],
          filters: ['custrecord_lmry_br_related_transaction', 'is', id_invoice]
        });
        var searchResult = searchTransactionField.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          brNossoNumero = searchResult[0].getValue({
            name: 'custrecord_lmry_br_nosso_numero'
          });

          idTransactionFields = searchResult[0].getValue({
            name: 'internalid'
          });

        }

        if (idTransactionFields != null && idTransactionFields != '') {
          if (nossoCorrelativo != '' && nossoCorrelativo != null) {
            nossoNumCorrelativo = parseInt(nossoCorrelativo) + 1;
          } else {
            nossoNumCorrelativo = 1;
          }

          if (brNossoNumero == '' || brNossoNumero == null) {
            nossoNumCorrelativo = parseInt(nossoNumCorrelativo);
            var longNumeroConsec = parseInt((nossoNumCorrelativo + '').length);
            for (var i = 0; i < (maxLimit - longNumeroConsec); i++) {
              llenarCeros += '0';
            }
            nossoNumero = nossoFijo + llenarCeros + nossoNumCorrelativo;

            var id = record.submitFields({
              type: 'customrecord_lmry_br_config_bank_ticket',
              id: record_id,
              values: {
                'custrecord_lmry_nossonumero_correlative': nossoNumCorrelativo
              }
            });

            var id = record.submitFields({
              type: 'customrecord_lmry_br_transaction_fields',
              id: idTransactionFields,
              values: {
                'custrecord_lmry_br_nosso_numero': nossoNumero
              }
            });
          } else {
            nossoNumero = brNossoNumero;
          }
        }
      } catch (err) {
        libraryMail.sendemail(' [ formarNossoNumero ] ' + err, LMRY_script);
      }
    }

    function search_folder() {
      try {
        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - PDF Boleto Bancario" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - PDF Boleto Bancario']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - PDF Boleto Bancario');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }


          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({
            type: config.Type.COMPANY_PREFERENCES
          });

          // set field values
          varCompanyReference.setValue({
            fieldId: 'custscript_lmry_br_boleto_bancario',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }



      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
      }
    }

    function reemplazarCaracteresEspeciales(cadena) {
      cadena = cadena.replace(/&gt;/g, '>');
      cadena = cadena.replace(/&lt;/g, '<');
      cadena = xml.escape(cadena);

      return cadena;
    }

    function obtenerCodigoBarras(monto) {
      var llenarCeros = '';
      var codBanco = '';
      var codMoneda = '';
      var digVerificador = '';
      var factorVencimiento = '';
      var valorBoleto = '';
      var cadena;
      var factorVencimiento_Valor;
      var camposCeros = '000000';
      var tipoCobranza = '00';

      if (monto != null && monto != '') {
        valorBoleto = monto.toString();
        valorBoleto = valorBoleto.replace(/\.| |\,/g, '');
      }


      if (codigoMoneda != null && codigoMoneda != '') {
        codMoneda = codigoMoneda.toString();
      }

      if (codigoBanco != null && codigoBanco != '') {
        codBanco = codigoBanco.toString();
      }

      if (dataVencimiento != null && dataVencimiento != null) {
        factorVencimiento = obtenerFactorVencimiento(dataVencimiento);
      }

      if (valorBoleto.length > 10) {
        while (valorBoleto.length < 14) {
          valorBoleto = "0" + valorBoleto
        }
        factorVencimiento_Valor = valorBoleto;
        factorVencimiento_Valor = factorVencimiento_Valor.substring(0, 14);

      } else {
        while (valorBoleto.length < 10) {
          valorBoleto = "0" + valorBoleto
        }
        factorVencimiento_Valor = factorVencimiento + valorBoleto;
      }

      cadena = codBanco + codMoneda + factorVencimiento_Valor + camposCeros + nossoNumero + tipoCobranza;
      digVerificador = calcularDVCodBarras(cadena);
      codigoBarras = codBanco + codMoneda + digVerificador + factorVencimiento_Valor + camposCeros + nossoNumero + tipoCobranza;
    }

    function calcularDVCodBarras(cadena) {
      var digito = '';
      var digito_int = '';

      var i, j;
      var vector = [];

      for (i = cadena.length - 1; i >= 0; i--) {
        digito = cadena[i];
        digito_int = parseInt(digito);
        vector.push(digito_int);
      }


      var suma = 0;
      var digitoMultiplicado;
      var t = 2;

      for (j = 0; j < vector.length; j++) {

        if (t <= 9) {
          digitoMultiplicado = vector[j] * t;
          t++;

        } else {
          t = 2;
          digitoMultiplicado = vector[j] * t;
          t++;
        }

        suma = suma + digitoMultiplicado;

      }

      var resto = suma % 11;
      digitoVerificador = 11 - resto;

      if (digitoVerificador == 0 || digitoVerificador == 10 || digitoVerificador == 11) {
        digitoVerificador = 1;
      }

      return digitoVerificador;

    }

    //Linea digital: Representación Numerica del Codigo de Barras
    function obtenerLineaDigital() {
      try {
        var digVerificador1 = '';
        var digVerificador2 = '';
        var digVerificador3 = '';

        //var longitud = codigoDeBarras.length;
        var campo1 = codigoBarras.substring(0, 4); //3419
        var campo2 = codigoBarras.substring(4, 5); //Digito Verificador del codigo de Barras
        var campo3 = codigoBarras.substring(5, 19); //FactorVencimiento(4 digitos) + valorTitulo(10 digitos)
        var campo4 = codigoBarras.substring(19, 24); // cartera(3 digitos) + NossoNumero(los 2 primeros digitos)
        var campo5 = codigoBarras.substring(24, 34); // NossoNumero(restantes 6 digitos) + pos31(1 digito) + Agencia(los 3 primeros digitos)
        var campo6 = codigoBarras.substring(34, 44); // Agencia(resta 1 digito) + codBeneficiario(6 digitos) + ceros (3 digitos)

        var campo_1_4 = campo1 + campo4;
        digVerificador1 = obtenerDigitoVerificadorLD(campo_1_4);
        digVerificador2 = obtenerDigitoVerificadorLD(campo5);
        digVerificador3 = obtenerDigitoVerificadorLD(campo6);

        //La linea digital posee 5 campos:
        //Campo1: 3419 + cartera(3 digitos) + NossoNumero(los 2 primeros digitos)
        var dig1_campo4 = campo4.substring(0, 1);
        var dig2_campo4 = campo4.substring(1, 5);
        var nuevo_campo4 = dig1_campo4 + "." + dig2_campo4;

        //Campo2: NossoNumero(restantes 6 digitos) + pos31(1 digito) + Agencia(los 3 primeros digitos)
        var dig1_campo5 = campo5.substring(0, 5);
        var dig2_campo5 = campo5.substring(5, 10);
        var nuevo_campo5 = dig1_campo5 + "." + dig2_campo5;

        //Campo3: Agencia(resta 1 digito) + codBeneficiario(6 digitos) + ceros (3 digitos)
        var dig1_campo6 = campo6.substring(0, 5);
        var dig2_campo6 = campo6.substring(5, 10);
        var nuevo_campo6 = dig1_campo6 + "." + dig2_campo6;

        //Campo4-->DV del codigo de Barras      campo5--->FactorVencimiento(4 digitos) + valorTitulo(10 digitos)
        lineaDigital = campo1 + nuevo_campo4 + digVerificador1 + " " + nuevo_campo5 + digVerificador2 + " " + nuevo_campo6 + digVerificador3 + " " + campo2 + " " + campo3;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerLineaDigital ] ' + err, LMRY_script);
      }
    }

    function obtenerSumaDigitosNumero(numero) {
      var suma = 0;
      var numeroString = numero.toString();
      var i;

      for (i = 0; i < numeroString.length; i++) {
        var digito = numeroString[i];
        digito_int = parseInt(digito);
        suma = suma + digito_int;
      }
      return suma;

    }

    function obtenerDigitoVerificadorLD(campo) {
      try {
        var digVerificador = '';
        var v = [];
        var i, j;
        var digMulti;
        var suma = 0;

        for (i = campo.length - 1; i >= 0; i--) {
          digito = campo[i];
          digito_int = parseInt(digito);
          v.push(digito_int);
        }

        for (j = 0; j < v.length; j++) {

          if (j % 2 == 0) {
            digMulti = v[j] * 2;
            digMulti = obtenerSumaDigitosNumero(digMulti);
          } else {
            digMulti = v[j] * 1;
            digMulti = obtenerSumaDigitosNumero(digMulti);

          }
          suma = suma + digMulti;

        }
        var resto = suma % 10;

        digVerificador = 10 - resto;
        if (digVerificador == 10) {
          digVerificador = 0;
        }

        return digVerificador;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDigitoVerificadorCriterioMod10 ] ' + err, LMRY_script);
      }
    }

    function obtenerFactorVencimiento(dataVencimiento) {
      try {
        var diferenciaDias = '';
        if (dataVencimiento != null && dataVencimiento != '') {
          var fechaBase = new Date('1997/10/07'); //Fecha Base (año mes dia)

          var fechaVencimiento = format.parse({
            value: dataVencimiento,
            type: format.Type.DATE
          });

          var resta = fechaVencimiento.getTime() - fechaBase.getTime();
          diferenciaDias = Math.round(resta / (1000 * 60 * 60 * 24));

          while (diferenciaDias > 9999) {
            diferenciaDias = diferenciaDias - 9000;
          }

          var diferenciaDiasString = diferenciaDias.toString();
          while (diferenciaDiasString.length < 4) {
            diferenciaDiasString = "0" + diferenciaDiasString
          }

          return diferenciaDiasString;
        } else {
          return diferenciaDias;
        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerFactorVencimiento ] ' + err, LMRY_script);
      }
    }

    function formandoInstrucciones(idInvoice) {
      try {
        var vector_custom_field = [];
        vector_custom_field = custom_field.split('|');

        //vector para el SALTO DE LINEA y el TEXTO LIBRE, en este vector se guarda la data junto con su posicion correspondiente
        var vector_data_pos = [];
        //vector para los ID DE LOS CAMPOS DE TIPO CUSTBODY, en este vector se guarda la data junto con su posicion correspondiente
        var vector_id = [];


        for (var t = 0; t < vector_custom_field.length; t++) {
          //Si contiene la palabra enter, se realizará un salto de linea
          if ((vector_custom_field[t]).toLowerCase() == 'enter') {
            var enter = '<br/>'
            vector_data_pos[t] = enter;

          } else {
            var ultimaPos = vector_custom_field[t].length;
            //Si la palabra esta dentro de llaves, son ID de los campos tipo custbody
            if (vector_custom_field[t].substring(0, 1) == '{' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == '}') {
              vector_id[t] = vector_custom_field[t].substring(1, ultimaPos - 1);
            }
            //Si la palabra esta dentro de corchetes, son texto Libre
            if (vector_custom_field[t].substring(0, 1) == '[' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == ']') {
              var textoLibre = vector_custom_field[t].substring(1, ultimaPos - 1);
              vector_data_pos[t] = textoLibre;
            }
          }

        }


        var vector_cadena_final = [];

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: idInvoice,
          columns: vector_id
        });

        for (var pos = 0; pos < vector_id.length; pos++) {
          if (vector_id[pos]) {

            var name_id = vector_id[pos];
            var valor_id = recordInvoice[name_id];
            var type_valor_id = typeof valor_id;

            if (type_valor_id == 'object' && recordInvoice[name_id] != null && recordInvoice[name_id] != '') {
              valor_id = recordInvoice[name_id][0].text;

              valor_id = reemplazarCaracteresEspeciales(valor_id);

              vector_cadena_final[pos] = valor_id;
            }
          }
        }

        //Guardando los valores de linea de salto y los valores de texto fijo
        for (var pos = 0; pos < vector_data_pos.length; pos++) {

          var enter_textoFijo = vector_data_pos[pos];

          if (enter_textoFijo == '<br/>') {
            vector_cadena_final[pos] = enter_textoFijo;
          }
          if (enter_textoFijo != '' && enter_textoFijo != null && enter_textoFijo != '<br/>') {
            enter_textoFijo = reemplazarCaracteresEspeciales(enter_textoFijo);
            vector_cadena_final[pos] = enter_textoFijo;

          }
        }

        instructions = vector_cadena_final.join(' ');
      } catch (err) {
        libraryMail.sendemail(' [ formandoInstrucciones ] ' + err, LMRY_script);
      }

    }

    function obtenerEspecieDOC(id_invoice) {
      try {
        //Busqueda del record customrecord_lmry_br_transaction_fields para obtener las siglas del campo Document Especie de un invoice determinado
        var searchBRTransactionFields = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: [{
              name: "custrecord_lmry_br_docu_specie_siglas",
              join: "CUSTRECORD_LMRY_BR_DOCUMENT_SPECIE",
              label: "BR Siglas"
            }

          ],
          filters: ['custrecord_lmry_br_related_transaction', 'is', id_invoice]
        });
        searchResult = searchBRTransactionFields.run().getRange(0, 1);
        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns

          var siglas_documentoEspecie = searchResult[0].getValue(columns[0]);
          if (siglas_documentoEspecie != null && siglas_documentoEspecie != '') {
            especieDoc = siglas_documentoEspecie;
          }
        }
      } catch (err) {
        libraryMail.sendemail(' [ obtenerEspecieDOC ] ' + err, LMRY_script);

      }

    }

    return {
      obtenerURLPdfBoletoBancario: obtenerURLPdfBoletoBancario
    };

  });
